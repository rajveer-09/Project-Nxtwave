/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, DEV_ROLE_COOKIE, devSessionAllowed, SESSION_COOKIE } from "@/common/auth/config";
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

/** Email + password sign-in (database mode). */
export async function passwordSignIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (authMode() !== "database") return { error: "Password sign-in needs the database. Use the development picker below.", email };
  if (!email || !password) return { error: "Enter your work email and password.", email };

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const db = getDb();
  const result = await passwordLogin(db, email, password, ip);
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "Too many attempts. Wait 15 minutes, or ask an Owner to reset your password."
          : "That email and password don't match an active account.",
      email,
    };
  }
  const token = await createSession(db, result.user.id, { ip, userAgent: requestHeaders.get("user-agent") });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
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
