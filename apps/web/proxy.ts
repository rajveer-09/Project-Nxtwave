/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { NextResponse, type NextRequest } from "next/server";
import { authMode, DEV_ROLE_COOKIE, SESSION_COOKIE, STUDENT_COOKIE } from "@/common/auth/config";
import { isRole } from "@/common/auth/roles";
import { canAccess } from "@/common/lib/nav";

/**
 * Optimistic route guard. It never touches the database:
 * - database mode: no session cookie → /login (the page then validates the session and role)
 * - dev mode: the picked role can't open this page → /forbidden
 * Pages repeat the real check with requireAccess(); this only saves a round trip.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Student portal: its own cookie; staff pages never accept it.
  if (pathname === "/me" || pathname.startsWith("/me/")) {
    if (!request.cookies.get(STUDENT_COOKIE)?.value) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  if (authMode() === "database") {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const login = new URL("/login", request.url);
      if (pathname !== "/") login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  const role = request.cookies.get(DEV_ROLE_COOKIE)?.value ?? "owner";
  if (isRole(role) && !canAccess(role, pathname)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|forbidden|.*\\.[a-z0-9]+$).*)"],
};
