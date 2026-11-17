/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { createHash, randomBytes } from "node:crypto";
import type { Role, SessionUser } from "@/common/auth/roles";
import type { Db } from "@/common/auth/core/db";

/**
 * Database sessions in core.sessions (ARCHITECTURE.md §5.1).
 * The browser holds a random token; only its SHA-256 is stored. A session is valid
 * while it hasn't expired, the staff member is active, and their session_version
 * hasn't been bumped (logout everywhere, password change, deactivation).
 */

export const SESSION_TTL_HOURS = 12;
/** Extend a session at most once an hour, so active users stay signed in. */
const EXTEND_WHEN_REMAINING_HOURS = SESSION_TTL_HOURS - 1;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const PLATFORM_ROLE_ORDER: Role[] = ["owner", "admin", "senior_instructor", "instructor", "success_coach"];

type StaffRow = {
  id: string;
  name: string;
  email: string;
  roles: { module: string; role: string }[] | null;
};

/**
 * Platform role: the 'platform' row if present, otherwise the highest staff role
 * across modules. 'viewer' alone gives no platform access.
 */
export function platformRole(roles: { module: string; role: string }[]): Role | null {
  const platform = roles.find((r) => r.module === "platform");
  if (platform && (PLATFORM_ROLE_ORDER as string[]).includes(platform.role)) return platform.role as Role;
  for (const role of PLATFORM_ROLE_ORDER) {
    if (roles.some((r) => r.role === role)) return role;
  }
  return null;
}

function toUser(row: StaffRow): SessionUser | null {
  const role = platformRole(row.roles ?? []);
  return role ? { id: String(row.id), name: row.name, email: row.email, role } : null;
}

const STAFF_WITH_ROLES = `
  SELECT s.id, s.name, lower(s.email::text) AS email,
         COALESCE(json_agg(json_build_object('module', r.module, 'role', r.role))
                  FILTER (WHERE r.module IS NOT NULL), '[]') AS roles
  FROM core.staff s
  LEFT JOIN core.staff_roles r ON r.staff_id = s.id`;

export async function findActiveStaffByEmail(db: Db, email: string) {
  const { rows } = await db.query<StaffRow & { password_hash: string | null }>(
    `${STAFF_WITH_ROLES.replace("SELECT s.id,", "SELECT s.id, s.password_hash,")}
     WHERE lower(s.email::text) = $1 AND s.active AND s.left_on IS NULL
     GROUP BY s.id`,
    [email.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  const user = toUser(row);
  return user ? { user, passwordHash: row.password_hash } : null;
}

export async function createSession(
  db: Db,
  staffId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM core.sessions WHERE expires_at < now()");
  await db.query(
    `INSERT INTO core.sessions (token_hash, staff_id, session_version, expires_at, ip, user_agent)
     SELECT $1, s.id, s.session_version, now() + make_interval(hours => $3), $4::inet, $5
     FROM core.staff s WHERE s.id = $2`,
    [hashToken(token), staffId, SESSION_TTL_HOURS, meta.ip ?? null, meta.userAgent?.slice(0, 400) ?? null],
  );
  return token;
}

/*
 * A checked session is remembered for up to a minute, so moving between pages doesn't pay a
 * database round trip each time. Sign-out, deactivation and role changes forget it at once on
 * this server; another server instance notices within the minute.
 */
const MEMO_MS = 60_000;
// Entries remove themselves after MEMO_MS (a timer, so rendering never reads the clock).
const memo = ((globalThis as unknown as { __sessionMemo?: Map<string, { user: SessionUser }> }).__sessionMemo ??= new Map());

function remember(key: string, user: SessionUser) {
  if (memo.size > 5000) memo.clear();
  const entry = { user };
  memo.set(key, entry);
  setTimeout(() => {
    if (memo.get(key) === entry) memo.delete(key);
  }, MEMO_MS).unref?.();
}

/** Forget remembered sessions: one person's (role change, deactivation) or everyone's. */
export function forgetSessions(staffId?: string) {
  if (!staffId) return memo.clear();
  for (const [key, entry] of memo) if (entry.user.id === staffId) memo.delete(key);
}

export async function getSessionUserByToken(db: Db, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const key = hashToken(token);
  const hit = memo.get(key);
  if (hit) return hit.user;
  const user = await lookupSession(db, token);
  if (user) remember(key, user);
  return user;
}

async function lookupSession(db: Db, token: string): Promise<SessionUser | null> {
  const { rows } = await db.query<StaffRow & { expires_at: string }>(
    `${STAFF_WITH_ROLES.replace("SELECT s.id,", "SELECT s.id, se.expires_at,")}
     JOIN core.sessions se ON se.staff_id = s.id
     WHERE se.token_hash = $1
       AND se.expires_at > now()
       AND se.session_version = s.session_version
       AND s.active AND s.left_on IS NULL
     GROUP BY s.id, se.expires_at`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  const remainingHours = (new Date(row.expires_at).getTime() - Date.now()) / 3_600_000;
  if (remainingHours < EXTEND_WHEN_REMAINING_HOURS) {
    await db.query(`UPDATE core.sessions SET expires_at = now() + make_interval(hours => $2) WHERE token_hash = $1`, [
      hashToken(token),
      SESSION_TTL_HOURS,
    ]);
  }
  return toUser(row);
}

export async function deleteSession(db: Db, token: string | undefined | null) {
  if (token) memo.delete(hashToken(token));
  if (token) await db.query("DELETE FROM core.sessions WHERE token_hash = $1", [hashToken(token)]);
}

/** Ends every session of a staff member (password change, deactivation, "sign out everywhere"). */
export async function revokeAllSessions(db: Db, staffId: string) {
  forgetSessions(staffId);
  await db.query("UPDATE core.staff SET session_version = session_version + 1 WHERE id = $1", [staffId]);
  await db.query("DELETE FROM core.sessions WHERE staff_id = $1", [staffId]);
}
