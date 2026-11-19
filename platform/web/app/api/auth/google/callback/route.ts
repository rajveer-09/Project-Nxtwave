/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { NextResponse, type NextRequest } from "next/server";
import { loginScopedCookieNames, OAUTH_COOKIE, SESSION_COOKIE } from "@/common/auth/config";
import { createSession, findActiveStaffByEmail } from "@/common/auth/core/sessions";
import { finishGoogleSignIn, type OAuthPending } from "@/common/auth/google";
import { clientIp } from "@/common/auth/request";
import { getDb } from "@/common/db/pool";

const KNOWN_ERRORS = new Set(["email_not_verified", "wrong_domain", "nonce_mismatch", "token_exchange_failed", "no_id_token"]);

function fail(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  let pending: OAuthPending | null = null;
  try {
    pending = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "null");
  } catch {
    pending = null;
  }
  if (!code || !state || !pending || pending.state !== state) return fail(request, "google_state");

  let email: string;
  try {
    ({ email } = await finishGoogleSignIn(code, pending));
  } catch (error) {
    const reason = error instanceof Error && KNOWN_ERRORS.has(error.message) ? error.message : "failed";
    return fail(request, `google_${reason}`);
  }

  const db = getDb();
  const staff = await findActiveStaffByEmail(db, email);
  if (!staff) return fail(request, "google_no_account");

  const token = await createSession(db, staff.user.id, {
    ip: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  for (const name of loginScopedCookieNames(request.cookies.getAll())) response.cookies.delete(name);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
