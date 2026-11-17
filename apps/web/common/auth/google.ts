/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google workspace sign-in: OpenID Connect authorization-code flow with PKCE,
 * state and nonce (same approach as the attendance app's internal/auth/google.go).
 * Only verified emails on GOOGLE_ALLOWED_DOMAIN that match an active core.staff
 * row can sign in.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const b64url = (buf: Buffer) => buf.toString("base64url");

export type OAuthPending = { state: string; nonce: string; verifier: string };

function redirectUri() {
  return `${process.env.APP_BASE_URL}/api/auth/google/callback`;
}

export function startGoogleSignIn(): { url: string; pending: OAuthPending } {
  const pending = { state: b64url(randomBytes(24)), nonce: b64url(randomBytes(24)), verifier: b64url(randomBytes(48)) };
  const challenge = b64url(createHash("sha256").update(pending.verifier).digest());
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  const domain = process.env.GOOGLE_ALLOWED_DOMAIN;
  if (domain) params.set("hd", domain);
  return { url: `${AUTH_URL}?${params}`, pending };
}

export type GoogleIdentity = { email: string; name: string };

export async function finishGoogleSignIn(code: string, pending: OAuthPending): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: pending.verifier,
    }),
  });
  if (!response.ok) throw new Error("token_exchange_failed");
  const { id_token: idToken } = (await response.json()) as { id_token?: string };
  if (!idToken) throw new Error("no_id_token");

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== pending.nonce) throw new Error("nonce_mismatch");
  const email = String(payload.email ?? "").toLowerCase();
  if (!email || payload.email_verified !== true) throw new Error("email_not_verified");
  const domain = process.env.GOOGLE_ALLOWED_DOMAIN?.toLowerCase();
  if (domain && (payload.hd !== domain || !email.endsWith(`@${domain}`))) throw new Error("wrong_domain");
  return { email, name: String(payload.name ?? email) };
}
