/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

/** Today's date in India (YYYY-MM-DD). All attendance and interaction dates are IST. */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "Good morning" before 12:00, "Good afternoon" until 17:00, then "Good evening" (India time). */
export function greetingIst(now: Date = new Date()): string {
  const hour = new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * A real calendar date like 2026-11-16 between 2000 and 2100. Dates typed into a date box (or a URL) can
 * be partial or nonsense, e.g. 0000-11-28, which the database rejects; anything else is not a date.
 */
export function isRealDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < "2000-01-01" || v > "2100-12-31") return false;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v;
}

/** "2026-11-16" + -7 → "2026-11-09" */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "2026-11-16" → "16 Nov 2026" */
export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
