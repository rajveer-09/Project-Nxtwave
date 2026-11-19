/**
 * Cookie that remembers whether the Overdue banner on /interactions is open (shared by the
 * server page and the browser toggle, so the first render already has the right state).
 *
 *   (missing)     open: the banner is a reminder, so every sign-in starts with it open
 *   "open"        the instructor opened it again: keep it open
 *   "hidden:<n>"  they hid it while <n> students were overdue: keep it closed until more are
 *
 * The nx_login_ prefix makes it last only until the next sign-in: sign-in and sign-out clear it
 * (LOGIN_SCOPED_PREFIX in common/auth/config.ts).
 */
export const OVERDUE_COOKIE = "nx_login_overdue";

export type OverduePref = { open: true } | { open: false; seen: number | null };

export function parseOverduePref(value: string | undefined): OverduePref {
  if (value === undefined || value === "open") return { open: true };
  const seen = value.startsWith("hidden:") ? Number.parseInt(value.slice("hidden:".length), 10) : NaN;
  return { open: false, seen: Number.isFinite(seen) ? seen : null };
}

/** Open when they haven't hidden it since signing in, or when more students are overdue than when they did. */
export function overdueStartsOpen(pref: OverduePref, count: number): boolean {
  return pref.open || (pref.seen !== null && count > pref.seen);
}
