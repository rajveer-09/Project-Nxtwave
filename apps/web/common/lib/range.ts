/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { addDays } from "@/common/lib/dates";

/** A validated from–to date range from the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD), defaulting to the last `days` days. */
export type Range = { from: string; to: string; days: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const valid = (v: unknown): v is string => typeof v === "string" && DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function parseRange(params: Record<string, string | string[] | undefined>, today: string, defaultDays = 30, maxDays = 400): Range {
  let to = valid(one(params.to)) ? one(params.to)! : today;
  if (to > today) to = today;
  let from = valid(one(params.from)) ? one(params.from)! : addDays(to, -(defaultDays - 1));
  if (from > to) from = to;
  if (daysBetween(from, to) > maxDays) from = addDays(to, -maxDays);
  return { from, to, days: daysBetween(from, to) + 1 };
}

/** Every date in the range, oldest first (for filling empty days in charts). */
export function eachDay(range: Pick<Range, "from" | "to">): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const shortDay = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
