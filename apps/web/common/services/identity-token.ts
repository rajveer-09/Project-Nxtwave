/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { SignJWT } from "jose";
import type { SessionUser } from "@/common/auth/roles";

/**
 * Short-lived identity token the web app attaches to every request it forwards to
 * a backend service (ARCHITECTURE.md §5.2). Each service has its own secret and
 * audience, so a token for one service is useless at another.
 */
export const TOKEN_TTL_SECONDS = 60;

export async function signIdentityToken(user: SessionUser, audience: string, secret: string): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer("student-hub-web")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}
