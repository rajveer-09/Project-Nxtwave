/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, DEV_ROLE_COOKIE, devSessionAllowed, SESSION_COOKIE, STUDENT_COOKIE } from "@/common/auth/config";
import { createStudentSession, NIAT_ID, STUDENT_SESSION_HOURS, studentPasswordLogin } from "@/common/auth/student/session";
import { passwordLogin } from "@/common/auth/core/login";
import { createSession, deleteSession } from "@/common/auth/core/sessions";
import { clientIp } from "@/common/auth/request";
import { isRole } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";

export type SignInState = { error: string | null; email: string };

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * One sign-in for everyone. A NIAT ID signs in as that student (their own page at /me); an email
 * signs in as staff, who then see what their role allows. Each kind keeps its own session cookie.
 */
export async function passwordSignIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (authMode() !== "database") return { error: "Sign-in needs the database. Use the development picker below.", email: identifier };
  if (!identifier || !password) return { error: "Enter your email or NIAT ID, and your password.", email: identifier };

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const db = getDb();
  const store = await cookies();
  const meta = { ip, userAgent: requestHeaders.get("user-agent") };

  if (NIAT_ID.test(identifier.toUpperCase())) {
    const niatId = identifier.toUpperCase();
    const result = await studentPasswordLogin(db, niatId, password, ip);
    if (!result.ok) {
      return {
        error: result.reason === "locked" ? "Too many attempts. Wait 15 minutes and try again." : "That NIAT ID and password don't match. Ask your instructor if you need a new password.",
        email: identifier,
      };
    }
    const token = await createStudentSession(db, niatId, meta);
    store.delete(SESSION_COOKIE);
    store.set(STUDENT_COOKIE, token, { ...sessionCookieOptions, maxAge: STUDENT_SESSION_HOURS * 3600 });
    redirect("/me");
  }

  const email = identifier.toLowerCase();
  if (!email.includes("@")) return { error: "Enter your work email, or your NIAT ID if you're a student.", email: identifier };
  const result = await passwordLogin(db, email, password, ip);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "Too many attempts. Wait 15 minutes, or ask an admin to reset your password."
          : "That email and password don't match an active account.",
      email: identifier,
    };
  }
  const token = await createSession(db, result.user.id, meta);
  store.delete(STUDENT_COOKIE);
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(safeNext(formData.get("next")));
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
