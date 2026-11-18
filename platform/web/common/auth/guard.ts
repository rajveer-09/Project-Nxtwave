/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { redirect } from "next/navigation";
import { canAccess } from "@/common/lib/nav";
import { getSessionUser } from "@/common/auth/session";

/**
 * Server-side access check for a page. proxy.ts does a quick optimistic redirect;
 * this is the authoritative check (defence in depth, per the Next.js auth guide).
 */
export async function requireAccess(pathname: string) {
  const user = await getSessionUser();
  if (user.mustSetPassword) redirect("/set-password");
  if (!canAccess(user.role, pathname)) redirect("/forbidden");
  return user;
}
