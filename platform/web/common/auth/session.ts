/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/common/db/pool";
import { authMode, DEV_ROLE_COOKIE, devSessionAllowed, SESSION_COOKIE, VIEW_AS_COOKIE } from "@/common/auth/config";
import { findActiveStaffById, getSessionUserByToken } from "@/common/auth/core/sessions";
import { canViewAs, isAdminRole, isRole, type SessionUser } from "@/common/auth/roles";

/** Fictional users for local UI work without a database ("dev" auth mode). */
const DEV_USERS: Record<SessionUser["role"], SessionUser> = {
  owner: { id: "dev-owner", name: "Priya K.", email: "owner@example.com", role: "owner" },
  admin: { id: "dev-admin", name: "Ravi V.", email: "admin@example.com", role: "admin" },
  senior_instructor: { id: "dev-senior", name: "Neha P.", email: "senior@example.com", role: "senior_instructor" },
  instructor: { id: "dev-instructor", name: "Karthik S.", email: "instructor@example.com", role: "instructor" },
  success_coach: { id: "dev-coach", name: "Farhan A.", email: "coach@example.com", role: "success_coach" },
};

/**
 * The person actually signed in, ignoring "view as". For starting or ending "view as" and for
 * anything about the signed-in person's own account; everything else uses getOptionalSessionUser.
 */
export const getRealSessionUser = cache(async function getRealSessionUser(): Promise<SessionUser | null> {
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
});

/**
 * The signed-in user, or null. Use in route handlers that answer with 401 themselves.
 * Looked up once per request, however many components ask (each lookup is a database round trip).
 *
 * "View as": while an admin or super admin is viewing as someone ranked below them
 * (VIEW_AS_COOKIE), this is that person, with `viewedBy` set to who is really signed in, so every
 * page, menu, access check and service call is exactly theirs. The cookie only names whom to show:
 * the rank rule is checked here on every request, so editing it can't widen anyone's access.
 * Nothing can be saved meanwhile (viewOnly() below, and the service proxies).
 */
export const getOptionalSessionUser = cache(async function getOptionalSessionUser(): Promise<SessionUser | null> {
  const real = await getRealSessionUser();
  if (!real || real.mustSetPassword || authMode() !== "database" || !isAdminRole(real.role)) return real;
  const targetId = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!targetId || targetId === real.id) return real;
  const target = await findActiveStaffById(getDb(), targetId);
  if (!target || !canViewAs(real.role, target.role)) return real;
  return { id: target.id, name: target.name, email: target.email, role: target.role, viewedBy: { id: real.id, name: real.name, role: real.role } };
});

/** The answer every save gives while viewing as someone (null when it may go ahead). */
export async function viewOnly(): Promise<{ ok: false; error: string } | null> {
  const user = await getOptionalSessionUser();
  if (!user?.viewedBy) return null;
  return { ok: false, error: `You're viewing as ${user.name}, so nothing can be saved. Exit "view as" to make changes as yourself.` };
}

/** The signed-in user; sends anyone else to /login. Use in pages and layouts. */
export async function getSessionUser(): Promise<SessionUser> {
  const user = await getOptionalSessionUser();
  if (!user) redirect("/login");
  return user;
}
