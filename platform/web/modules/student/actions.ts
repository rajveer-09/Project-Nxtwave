/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import type { Pool } from "pg";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMode } from "@/common/auth/config";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/common/auth/core/password";
import { clientIp } from "@/common/auth/request";
import {
  createStudentSession,
  deleteStudentSession,
  requireStudent,
  STUDENT_COOKIE,
  STUDENT_SESSION_HOURS,
  studentCookieOptions,
} from "@/common/auth/student/session";
import { getDb } from "@/common/db/pool";

export async function studentSignOut() {
  const store = await cookies();
  if (authMode() === "database") await deleteStudentSession(getDb(), store.get(STUDENT_COOKIE)?.value);
  store.delete(STUDENT_COOKIE);
  redirect("/login");
}

export type PasswordState = { error: string | null; done: boolean };

/**
 * A student sets their own password: required after the first sign-in (default password) or after an
 * admin issues one. Just signed in with that password, so it isn't asked again then. Signs out other devices.
 */
export async function changeOwnPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const student = await requireStudent();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = passwordPolicyError(next);
  if (problem) return { error: problem, done: false };
  if (next !== confirm) return { error: "The two new passwords don't match.", done: false };
  if (!student.mustChangePassword && next === current) return { error: "Choose a password different from your current one.", done: false };

  const pool = getDb() as unknown as Pool;
  if (!student.mustChangePassword) {
    const { rows } = await pool.query<{ password_hash: string | null }>("SELECT password_hash FROM core.student_accounts WHERE niat_id = $1", [student.niatId]);
    if (!(await verifyPassword(current, rows[0]?.password_hash))) return { error: "Your current password isn't right.", done: false };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('app.source', 'ui', true), set_config('app.actor_name', $1, true), set_config('app.actor_role', 'student', true),
              set_config('app.source_detail', 'student changed own password', true)`,
      [student.name],
    );
    await client.query(
      `UPDATE core.student_accounts SET password_hash = $2, must_change_password = false, session_version = session_version + 1 WHERE niat_id = $1`,
      [student.niatId, await hashPassword(next)],
    );
    await client.query("DELETE FROM core.student_sessions WHERE niat_id = $1", [student.niatId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  // Stay signed in on this device with a fresh session.
  const requestHeaders = await headers();
  const token = await createStudentSession(pool as never, student.niatId, { ip: clientIp(requestHeaders), userAgent: requestHeaders.get("user-agent") });
  (await cookies()).set(STUDENT_COOKIE, token, { ...studentCookieOptions, maxAge: STUDENT_SESSION_HOURS * 3600 });
  redirect("/me");
}
