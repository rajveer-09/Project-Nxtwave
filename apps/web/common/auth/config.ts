/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

/**
 * Auth mode, readable from proxy.ts, route handlers and server code.
 * - "database": real sign-in against core.staff / core.sessions (WEB_DATABASE_URL set)
 * - "dev":      role picker on /login, no database (local UI work only)
 */
export type AuthMode = "database" | "dev";

export function authMode(): AuthMode {
  return process.env.WEB_DATABASE_URL ? "database" : "dev";
}

export function devSessionAllowed(): boolean {
  return authMode() === "dev" && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_SESSION === "true");
}

export const SESSION_COOKIE = "nx_session";
/** Student sessions use their own cookie (common/auth/student/session.ts). */
export const STUDENT_COOKIE = "nx_student";
export const DEV_ROLE_COOKIE = "dev_role";
export const OAUTH_COOKIE = "nx_oauth";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_BASE_URL);
}
