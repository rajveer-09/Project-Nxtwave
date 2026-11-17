/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import type { SessionUser } from "@/common/auth/roles";
import type { Db } from "@/common/auth/core/db";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "@/common/auth/core/password";
import { findActiveStaffByEmail } from "@/common/auth/core/sessions";

/** Lock a key (email or IP) after this many failures inside the window. */
export const MAX_FAILURES = 5;
export const FAILURE_WINDOW_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "locked" };

async function recentFailures(db: Db, keys: string[]) {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM core.login_failures
     WHERE key = ANY($1) AND at > now() - make_interval(mins => $2)
     GROUP BY key ORDER BY n DESC LIMIT 1`,
    [keys, FAILURE_WINDOW_MINUTES],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Email + password sign-in with a per-email and per-IP lockout
 * (same rule NxtRank uses: 5 failures in 15 minutes).
 */
export async function passwordLogin(db: Db, email: string, password: string, ip: string | null): Promise<LoginResult> {
  const emailKey = `email:${email.trim().toLowerCase()}`;
  const keys = ip ? [emailKey, `ip:${ip}`] : [emailKey];

  if ((await recentFailures(db, keys)) >= MAX_FAILURES) return { ok: false, reason: "locked" };

  const found = await findActiveStaffByEmail(db, email);
  const valid = await verifyPassword(password, found?.passwordHash ?? DUMMY_HASH);

  if (!found || !valid || !found.passwordHash) {
    for (const key of keys) await db.query("INSERT INTO core.login_failures (key) VALUES ($1)", [key]);
    return { ok: false, reason: "invalid" };
  }

  await db.query("DELETE FROM core.login_failures WHERE key = $1", [emailKey]);
  if (needsRehash(found.passwordHash)) {
    // Upgrade migrated Interactions / Attendance hashes to the current format.
    await db.query("UPDATE core.staff SET password_hash = $1 WHERE id = $2", [await hashPassword(password), found.user.id]);
  }
  return { ok: true, user: found.user };
}
