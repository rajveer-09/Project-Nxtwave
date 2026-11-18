/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

"use server";

import type { Pool } from "pg";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, DEV_ROLE_COOKIE, devSessionAllowed, SESSION_COOKIE, STUDENT_COOKIE } from "@/common/auth/config";
import { createStudentSession, NIAT_ID, STUDENT_SESSION_HOURS, studentPasswordLogin } from "@/common/auth/student/session";
import { passwordLogin } from "@/common/auth/core/login";
import { createSession, deleteSession, findActiveStaffByEmail, forgetSessions, getSessionUserByToken } from "@/common/auth/core/sessions";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/common/auth/core/password";
import { clientIp } from "@/common/auth/request";
import { isRole } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";

export type SignInState = { error: string | null; email: string; kind: "student" | "staff" };

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * Sign-in, with a Student / Staff choice on the page. Students: NIAT ID (their own page at /me).
 * Staff: work email, then what their role allows. Each kind keeps its own session cookie. Anyone
 * who hasn't chosen a password yet signs in with the default first password and chooses one next.
 */
export async function passwordSignIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const kind = formData.get("kind") === "student" ? "student" : "staff";
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fail = (error: string): SignInState => ({ error, email: identifier, kind });
  if (authMode() !== "database") return fail("Sign-in needs the database. Use the development picker below.");
  if (!identifier || !password) return fail(kind === "student" ? "Enter your NIAT ID and password." : "Enter your work email and password.");

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const db = getDb();
  const store = await cookies();
  const meta = { ip, userAgent: requestHeaders.get("user-agent") };

  if (kind === "student") {
    const niatId = identifier.toUpperCase();
    if (!NIAT_ID.test(niatId)) return fail("Enter your NIAT ID, for example N24H01A0031.");
    const result = await studentPasswordLogin(db, niatId, password, ip);
    if (!result.ok) {
      return fail(
        result.reason === "locked"
          ? "Too many attempts. Wait 15 minutes and try again."
          : "That NIAT ID and password don't match. First time here? Use the default password you were given.",
      );
    }
    const token = await createStudentSession(db, niatId, meta);
    store.delete(SESSION_COOKIE);
    store.set(STUDENT_COOKIE, token, { ...sessionCookieOptions, maxAge: STUDENT_SESSION_HOURS * 3600 });
    redirect("/me");
  }

  const email = identifier.toLowerCase();
  if (!email.includes("@")) return fail("Enter your work email, for example name@nxtwave.co.in.");
  const result = await passwordLogin(db, email, password, ip);
  if (!result.ok) {
    return fail(
      result.reason === "locked"
        ? "Too many attempts. Wait 15 minutes, or ask an admin to reset your password."
        : "That email and password don't match an active account. First time here? Use the default password you were given.",
    );
  }
  const token = await createSession(db, result.user.id, meta);
  store.delete(STUDENT_COOKIE);
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
  // First sign-in with the default password: choose one before anything else.
  redirect(result.user.mustSetPassword ? "/set-password" : safeNext(formData.get("next")));
}

export type SetPasswordState = { error: string | null };

/**
 * Staff choose their own password: required after signing in with the default first password
 * (core.staff.must_set_password), and available later from the same page with the current one.
 * Ends every other session, then signs this device in again.
 */
export async function setOwnPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  if (authMode() !== "database") return { error: "Passwords need the database." };
  const store = await cookies();
  const db = getDb();
  const user = await getSessionUserByToken(db, store.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = passwordPolicyError(next);
  if (problem) return { error: problem };
  if (next !== confirm) return { error: "The two new passwords don't match." };
  if (!user.mustSetPassword) {
    const found = await findActiveStaffByEmail(db, user.email);
    if (!(await verifyPassword(current, found?.passwordHash ?? null))) return { error: "Your current password isn't right." };
    if (current === next) return { error: "Choose a password different from your current one." };
  }

  const pool = db as unknown as Pool;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('app.source', 'ui', true), set_config('app.source_detail', $5, true),
              set_config('app.actor_staff_id', $1, true), set_config('app.actor_name', $2, true),
              set_config('app.actor_email', $3, true), set_config('app.actor_role', $4, true)`,
      [user.id, user.name, user.email, user.role, user.mustSetPassword ? "chose a password at first sign-in" : "changed own password"],
    );
    await client.query("UPDATE core.staff SET password_hash = $2, must_set_password = false, session_version = session_version + 1 WHERE id = $1", [
      user.id,
      await hashPassword(next),
    ]);
    await client.query("DELETE FROM core.sessions WHERE staff_id = $1", [user.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  forgetSessions(user.id);

  const requestHeaders = await headers();
  const token = await createSession(db, user.id, { ip: clientIp(requestHeaders), userAgent: requestHeaders.get("user-agent") });
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect("/");
}

/** Only same-site paths: "/students?x=1" yes; "//evil.com", "https://…", "/\\evil" no. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return /^\/(?![/\\])/.test(next) ? next : "/";
}

/** Development-only role picker (no database). */
export async function devSignIn(formData: FormData) {
  if (!devSessionAllowed()) throw new Error("Development sign-in is disabled.");
  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) throw new Error("Unknown role");
  (await cookies()).set(DEV_ROLE_COOKIE, role, { ...sessionCookieOptions, maxAge: 60 * 60 * 12 });
  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  if (authMode() === "database") {
    await deleteSession(getDb(), store.get(SESSION_COOKIE)?.value);
  }
  store.delete(SESSION_COOKIE);
  store.delete(DEV_ROLE_COOKIE);
  redirect("/login");
}
