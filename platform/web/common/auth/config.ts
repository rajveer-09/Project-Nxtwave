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

/**
 * Cookies named nx_login_* hold choices that last until the next sign-in, e.g. a hidden reminder
 * (modules/interactions/frontend/lib/overdue-cookie.ts). Every sign-in and sign-out clears them.
 */
export const LOGIN_SCOPED_PREFIX = "nx_login_";

/**
 * "View as": the staff id an admin or super admin is looking at NxtOne as (read-only; see
 * common/auth/session.ts). Login-scoped, so signing in or out ends it; it also expires after an hour.
 */
export const VIEW_AS_COOKIE = `${LOGIN_SCOPED_PREFIX}view_as`;
/** The same for a student: the NIAT ID whose portal (/me) an admin or super admin is viewing, read-only. */
export const VIEW_AS_STUDENT_COOKIE = `${LOGIN_SCOPED_PREFIX}view_as_student`;
export const VIEW_AS_MINUTES = 60;

/** Names of the login-scoped cookies among these, to delete at sign-in / sign-out. */
export function loginScopedCookieNames(all: { name: string }[]): string[] {
  return all.map((c) => c.name).filter((name) => name.startsWith(LOGIN_SCOPED_PREFIX));
}

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_BASE_URL);
}
