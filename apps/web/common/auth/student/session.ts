/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, STUDENT_COOKIE } from "@/common/auth/config";
import type { Db } from "@/common/auth/core/db";
import { DUMMY_HASH, hashPassword, needsRehash, verifyPassword } from "@/common/auth/core/password";
import { FAILURE_WINDOW_MINUTES, MAX_FAILURES } from "@/common/auth/core/login";
import { hashToken } from "@/common/auth/core/sessions";
import { getDb } from "@/common/db/pool";

/**
 * Student sign-in, kept apart from staff: own table (core.student_accounts), own sessions
 * (core.student_sessions) and own cookie. A student session never opens a staff page and a
 * staff session never opens /me.
 */

export { STUDENT_COOKIE };
export const STUDENT_SESSION_HOURS = 24 * 7;
export const NIAT_ID = /^N\d{2}H\d{2}[AB]\d{4}$/;

export type StudentUser = { niatId: string; name: string; mustChangePassword: boolean };

export const studentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function studentByToken(db: Db, token: string | undefined | null): Promise<StudentUser | null> {
  if (!token) return null;
  const { rows } = await db.query<{ niat_id: string; full_name: string; must_change_password: boolean }>(
    `SELECT a.niat_id, s.full_name, a.must_change_password
     FROM core.student_sessions se
     JOIN core.student_accounts a ON a.niat_id = se.niat_id
     JOIN core.students s ON s.niat_id = a.niat_id
     WHERE se.token_hash = $1 AND se.expires_at > now() AND se.session_version = a.session_version
       AND a.active AND s.status = 'active'`,
    [hashToken(token)],
  );
  const r = rows[0];
  return r ? { niatId: r.niat_id, name: r.full_name, mustChangePassword: r.must_change_password } : null;
}

/** Looked up once per request. */
export const getOptionalStudent = cache(async (): Promise<StudentUser | null> => {
  const store = await cookies();
  if (authMode() !== "database") return null;
  return studentByToken(getDb(), store.get(STUDENT_COOKIE)?.value);
});

/** The signed-in student; anyone else goes to the student sign-in. */
export async function requireStudent(): Promise<StudentUser> {
  const student = await getOptionalStudent();
  if (!student) redirect("/login");
  return student;
}

export async function createStudentSession(db: Db, niatId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomBytes(32).toString("base64url");
  await db.query("DELETE FROM core.student_sessions WHERE expires_at < now()");
  await db.query(
    `INSERT INTO core.student_sessions (token_hash, niat_id, session_version, expires_at, ip, user_agent)
     SELECT $1, a.niat_id, a.session_version, now() + make_interval(hours => $3), $4::inet, $5
     FROM core.student_accounts a WHERE a.niat_id = $2`,
    [hashToken(token), niatId, STUDENT_SESSION_HOURS, meta.ip ?? null, meta.userAgent?.slice(0, 400) ?? null],
  );
  await db.query("UPDATE core.student_accounts SET last_sign_in_at = now() WHERE niat_id = $1", [niatId]);
  return token;
}

export async function deleteStudentSession(db: Db, token: string | undefined | null) {
  if (token) await db.query("DELETE FROM core.student_sessions WHERE token_hash = $1", [hashToken(token)]);
}

/** NIAT ID + password, with the staff lockout rule (5 failures in 15 minutes per ID and per IP). */
export async function studentPasswordLogin(db: Db, niatId: string, password: string, ip: string | null): Promise<{ ok: true } | { ok: false; reason: "invalid" | "locked" }> {
  const idKey = `student:${niatId}`;
  const keys = ip ? [idKey, `ip:${ip}`] : [idKey];
  const { rows: fails } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM core.login_failures WHERE key = ANY($1) AND at > now() - make_interval(mins => $2)
     GROUP BY key ORDER BY n DESC LIMIT 1`,
    [keys, FAILURE_WINDOW_MINUTES],
  );
  if ((fails[0]?.n ?? 0) >= MAX_FAILURES) return { ok: false, reason: "locked" };

  const { rows } = await db.query<{ password_hash: string | null }>(
    `SELECT a.password_hash FROM core.student_accounts a JOIN core.students s ON s.niat_id = a.niat_id
     WHERE a.niat_id = $1 AND a.active AND s.status = 'active'`,
    [niatId],
  );
  const hash = rows[0]?.password_hash ?? null;
  const valid = await verifyPassword(password, hash ?? DUMMY_HASH);
  if (!hash || !valid) {
    for (const key of keys) await db.query("INSERT INTO core.login_failures (key) VALUES ($1)", [key]);
    return { ok: false, reason: "invalid" };
  }
  await db.query("DELETE FROM core.login_failures WHERE key = $1", [idKey]);
  if (needsRehash(hash)) await db.query("UPDATE core.student_accounts SET password_hash = $1 WHERE niat_id = $2", [await hashPassword(password), niatId]);
  return { ok: true };
}
