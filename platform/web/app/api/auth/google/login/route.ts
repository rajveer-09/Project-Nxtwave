/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { NextResponse } from "next/server";
import { authMode, googleConfigured, OAUTH_COOKIE } from "@/common/auth/config";
import { startGoogleSignIn } from "@/common/auth/google";

export async function GET(request: Request) {
  if (authMode() !== "database" || !googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }
  const { url, pending } = startGoogleSignIn();
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}
