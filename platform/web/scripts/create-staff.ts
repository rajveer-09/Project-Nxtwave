/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

/**
 * Create (or update) a staff account with a platform role.
 * Used to bootstrap the first Owner before the Staff & roles screen can add people.
 *
 *   STAFF_PASSWORD='…' node scripts/create-staff.ts --email you@nxtwave.co.in --name "Your Name" --role owner
 *
 * Reads DATABASE_URL_OWNER (or WEB_DATABASE_URL). The password comes from the
 * STAFF_PASSWORD environment variable so it never appears in shell history or
 * process listings. Omit it for a Google-only account.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import { hashPassword, passwordPolicyError } from "../common/auth/core/password.ts";

const ROLES = ["owner", "admin", "senior_instructor", "instructor"];

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "instructor" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role ?? "instructor";
if (!email || !name) fail("Usage: node scripts/create-staff.ts --email <email> --name <name> [--role owner|admin|senior_instructor|instructor]");
if (!ROLES.includes(role)) fail(`Role must be one of: ${ROLES.join(", ")}`);

const url = process.env.DATABASE_URL_OWNER ?? process.env.WEB_DATABASE_URL;
if (!url) fail("Set DATABASE_URL_OWNER or WEB_DATABASE_URL.");

const password = process.env.STAFF_PASSWORD;
if (password) {
  const problem = passwordPolicyError(password);
  if (problem) fail(problem);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO core.staff (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = COALESCE(EXCLUDED.password_hash, core.staff.password_hash),
           active = true
     RETURNING id`,
    [email, name, password ? await hashPassword(password) : null],
  );
  await client.query(
    `INSERT INTO core.staff_roles (staff_id, module, role) VALUES ($1, 'platform', $2)
     ON CONFLICT (staff_id, module) DO UPDATE SET role = EXCLUDED.role`,
    [rows[0].id, role],
  );
  await client.query("COMMIT");
  console.log(`Saved ${email} as ${role}${password ? " with a password" : " (Google sign-in only)"}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
