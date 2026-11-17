/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/common/db/pool";
import { authMode, DEV_ROLE_COOKIE, devSessionAllowed, SESSION_COOKIE } from "@/common/auth/config";
import { getSessionUserByToken } from "@/common/auth/core/sessions";
import { isRole, type SessionUser } from "@/common/auth/roles";

/** Fictional users for local UI work without a database ("dev" auth mode). */
const DEV_USERS: Record<SessionUser["role"], SessionUser> = {
  owner: { id: "dev-owner", name: "Priya K.", email: "owner@example.com", role: "owner" },
  admin: { id: "dev-admin", name: "Ravi V.", email: "admin@example.com", role: "admin" },
  senior_instructor: { id: "dev-senior", name: "Neha P.", email: "senior@example.com", role: "senior_instructor" },
  instructor: { id: "dev-instructor", name: "Karthik S.", email: "instructor@example.com", role: "instructor" },
  success_coach: { id: "dev-coach", name: "Farhan A.", email: "coach@example.com", role: "success_coach" },
};

/** The signed-in user, or null. Use in route handlers that answer with 401 themselves. */
export async function getOptionalSessionUser(): Promise<SessionUser | null> {
  // Read request data first: during prerendering this defers the rest to request time.
  const store = await cookies();
  if (authMode() === "dev") {
    if (!devSessionAllowed()) {
      throw new Error("Development sign-in is disabled in production. Set WEB_DATABASE_URL for real sign-in.");
    }
    const role = store.get(DEV_ROLE_COOKIE)?.value;
    return DEV_USERS[isRole(role) ? role : "owner"];
  }
  return getSessionUserByToken(getDb(), store.get(SESSION_COOKIE)?.value);
}

/** The signed-in user; sends anyone else to /login. Use in pages and layouts. */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await getOptionalSessionUser();
  if (!user) redirect("/login");
  return user;
}
