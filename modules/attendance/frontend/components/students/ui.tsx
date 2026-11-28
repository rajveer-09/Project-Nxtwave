/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { selectClass } from "@/common/components/search-field";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { Band, Period, PeriodKind, Term } from "@nxtone/attendance-ui/types";

/*
 * Shared pieces of the DSA attendance › Students pages. Every count, % and band comes from the
 * attendance service (stats module); nothing here decides how a day counts.
 */

/** Text inputs on these pages: NxtOne's field look at a comfortable height. */
export const inputClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
export { selectClass };

export type BandKey = Exclude<Band, "none">;
export const BAND_ORDER: BandKey[] = ["below_60", "60_to_75", "75_plus"];
export const isBand = (v: string | null): v is BandKey => !!v && (BAND_ORDER as string[]).includes(v);

export const BAND_INFO: Record<BandKey, { label: string; cls: string; dot: string }> = {
  below_60: { label: "Below 60%", cls: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900", dot: "bg-red-500" },
  "60_to_75": { label: "60% – 75%", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900", dot: "bg-amber-500" },
  "75_plus": { label: "75% and above", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900", dot: "bg-emerald-600" },
};

export const pctText = (p: number | null) => (p === null ? "–" : `${p.toFixed(1)}%`);

/** The % in its band's colour; "–" when nothing is marked. The number is always shown, so colour is never the only signal. */
export function PctBadge({ pct, band }: { pct: number | null; band: Band }) {
  if (band === "none" || pct === null) return <span className="text-muted-foreground">–</span>;
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular ring-1 ring-inset", BAND_INFO[band].cls)}>{pct.toFixed(1)}%</span>;
}

export function DemoPill() {
  return <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 align-middle text-[10px] font-semibold text-muted-foreground uppercase ring-1 ring-border ring-inset">Demo</span>;
}

export const hallLabel = (h: string) => h || "No hall";

/** Halls in natural order (Hall 2 before Hall 10); no hall last. */
export function byHall(a: string, b: string) {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso + "T00:00:00Z"));
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso + "T00:00:00Z"));
export const fmtMonth = (ym: string) => monthFmt.format(new Date(ym + "-01T00:00:00Z"));

export function TermRange({ term }: { term: Term }) {
  if (!term) return null;
  return (
    <span>
      {term.name}: {fmtDate(term.start)} to {fmtDate(term.end)}
    </span>
  );
}

/** Internship and registration-pending: names and colours. */
export const CATEGORY_INFO: Record<PeriodKind, { label: string; short: string; mark: string; cls: string; dot: string }> = {
  INTERNSHIP: {
    label: "Internship Period",
    short: "Internship",
    mark: "Present",
    cls: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-900",
    dot: "bg-violet-500",
  },
  REGISTRATION_PENDING: {
    label: "Term 5 Registration Pending",
    short: "Registration pending",
    mark: "Absent",
    cls: "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-900",
    dot: "bg-orange-500",
  },
};

export const PERIOD_STATE_LABEL: Record<Period["state"], string> = {
  upcoming: "Upcoming",
  active: "In progress",
  ended: "Ended",
  pending: "Still pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** "12 Oct 2026 – 26 Oct 2026 · 15 days (5 attendance days)", plus registration completion. */
export function PeriodDates({ p }: { p: Period }) {
  return (
    <span>
      {fmtDate(p.start)} – {fmtDate(p.end)} · {p.calendar_days} day{p.calendar_days === 1 ? "" : "s"} ({p.attendance_days} attendance day
      {p.attendance_days === 1 ? "" : "s"})
      {p.kind === "REGISTRATION_PENDING" &&
        (p.completed_on ? <> · registration completed by {fmtDate(p.completed_on)}</> : <> · not completed yet (last seen pending {fmtDate(p.end)})</>)}
    </span>
  );
}

/** Notice boxes: red for errors, amber for warnings, green for done. */
export const NOTICE = {
  error: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  warning: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  success: "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  muted: "rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground",
} as const;

/** A red text button (delete, cancel) that still reads in dark mode. */
export const DANGER_BUTTON = "bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700";

/** The student detail page, keeping the chosen term. */
export const studentHref = (id: string, term = "") =>
  `/attendance/students/${encodeURIComponent(id)}${term ? `?${new URLSearchParams({ term })}` : ""}`;

/** The term chosen with ?term=<id>; "" is the current term. */
export const useTermParam = () => useSearchParams().get("term") ?? "";

/**
 * After any change to a student, a mark or an internship: every attendance query refetches
 * (lists, profiles, months, sheets, halls, internships, analytics, exports all live under "attendance").
 */
export function refreshAttendance(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["attendance"] });
}

/** Term picker: newest first, the current one marked; picking the current term clears ?term. */
export function TermPicker() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const terms = useQuery({ queryKey: ["attendance", "terms"], queryFn: attendanceApi.terms });
  const list = terms.data?.terms ?? [];
  if (list.length < 1) return null;
  const current = list.find((t) => t.is_current)?.id;
  const value = params.get("term") ?? String(current ?? "");
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold">
      Term
      <select
        className={selectClass}
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === String(current)) next.delete("term");
          else next.set("term", e.target.value);
          const qs = next.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }}
      >
        {[...list]
          .sort((a, b) => b.start.localeCompare(a.start))
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.is_current ? " (current)" : ""}
            </option>
          ))}
      </select>
    </label>
  );
}
