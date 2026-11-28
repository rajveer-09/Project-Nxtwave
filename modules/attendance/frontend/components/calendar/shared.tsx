/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { ApiError } from "@/common/lib/api-client";
import { cn } from "@/common/lib/utils";
import { fmtDate } from "@nxtone/attendance-ui/components/students/ui";
import type { AdminRef, CalendarEntryRange, CalendarImpact, DayType, EntryKey, EntrySource } from "@nxtone/attendance-ui/types";

/*
 * Shared pieces of the DSA attendance Calendar. Whether a day counts is always decided by the
 * attendance service (stats.ResolveDay); this only formats what it returns.
 */

/** Day kinds: names, the month-view cell colour and a chip colour. */
export const KIND_INFO: Record<DayType | "sunday", { label: string; cell: string; chip: string }> = {
  working: { label: "Working", cell: "bg-card", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900" },
  holiday: { label: "Holiday", cell: "bg-slate-100 dark:bg-slate-800/70", chip: "bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600" },
  exam: { label: "Exam", cell: "bg-amber-50 dark:bg-amber-950/40", chip: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900" },
  exam_prep: { label: "Exam preparation", cell: "bg-rose-50 dark:bg-rose-950/40", chip: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900" },
  event: { label: "Event", cell: "bg-blue-50 dark:bg-blue-950/40", chip: "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900" },
  sunday: { label: "Sunday", cell: "bg-muted/70", chip: "bg-muted text-muted-foreground ring-border" },
};
export const kindLabel = (k: string) => (KIND_INFO[k as DayType | "sunday"] ?? KIND_INFO.working).label;
export const DAY_TYPES: DayType[] = ["holiday", "exam", "exam_prep", "event", "working"];

export const LEGACY = "Legacy / Source unavailable";
export const SOURCE_LABEL: Record<EntrySource, string> = {
  legacy: LEGACY,
  manual: "Manual entry",
  calendar_import: "Calendar import",
  attendance_import: "Attendance import",
  students_import: "Students import",
};

const timeFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const istDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" });
export const fmtTime = (iso: string) => `${timeFmt.format(new Date(iso))} IST`;
/** The IST calendar date of a timestamp, as YYYY-MM-DD. */
export const dayOf = (iso: string) => istDay.format(new Date(iso));
export const scopeLabel = (a: string) => (a === "ALL" ? "All degrees" : `${a} only`);
export const rangeText = (start: string, end: string) => (start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`);
export const keysOf = (rs: CalendarEntryRange[]): EntryKey[] => rs.flatMap((r) => r.dates.map((date) => ({ date, applies_to: r.applies_to })));
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A form control on these pages. */
export const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
export const DANGER = "bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700";

export type Msg = { ok: boolean; text: string } | null;

export function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p
      role={msg.ok ? "status" : "alert"}
      className={cn(
        "rounded-lg border px-3 py-2 text-[13px]",
        msg.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
      )}
    >
      {msg.text}
    </p>
  );
}

/** When and by whom; legacy rows have neither and are never guessed. */
export function Who({ at, by, unknown }: { at: string | null; by: AdminRef; unknown: string }) {
  if (!at) return <span className="text-muted-foreground">{unknown}</span>;
  return (
    <span className="flex flex-col">
      <span className="whitespace-nowrap">{fmtTime(at)}</span>
      <span className="text-xs text-muted-foreground">{by ? by.name || by.email : "Admin account removed"}</span>
    </span>
  );
}

export const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

/** A centred dialog with a scrolling body (focus trap and Esc come from the dialog). */
export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[13px]">{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4 text-[13px]">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** What a calendar change does to attendance days. Marks are never changed. */
export function ImpactSummary({ impact }: { impact: CalendarImpact }) {
  const byDegree = (pick: (c: CalendarImpact["changes"][number]) => boolean) => {
    const m: Record<string, number> = {};
    for (const c of impact.changes) if (pick(c)) m[c.degree] = (m[c.degree] ?? 0) + 1;
    return Object.entries(m)
      .map(([d, n]) => `${n} for ${d}`)
      .join(", ");
  };
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">Effect on attendance</h3>
      {impact.changes.length === 0 ? (
        <p>No attendance day changes: every date is decided the same way afterwards (for example, another entry for the same degree still applies).</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {impact.start_counting > 0 ? (
            <li>
              <b>{impact.start_counting}</b> date(s) start counting as class days ({byDegree((c) => c.counting_changes && c.after.counted)}). <b>{impact.marks_start}</b> saved
              mark(s) on them will count toward percentages. Days with no mark stay out of the %, never counted as absent.
            </li>
          ) : null}
          {impact.stop_counting > 0 ? (
            <li>
              <b>{impact.stop_counting}</b> date(s) stop counting ({byDegree((c) => c.counting_changes && !c.after.counted)}). Their <b>{impact.marks_stop}</b> saved mark(s) are
              kept but ignored by percentages.
            </li>
          ) : null}
          {impact.changes.some((c) => !c.counting_changes) ? <li>Some dates only change their type or label (future dates, or dates outside a term, never count yet).</li> : null}
        </ul>
      )}
      {impact.changes.length > 0 ? (
        <div className="max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Effect on each date and degree</caption>
            <thead className="sticky top-0 bg-surface-subtle text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-semibold">Date</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Degree</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Now</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">After</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Marks</th>
              </tr>
            </thead>
            <tbody>
              {impact.changes.map((c) => (
                <tr key={c.date + c.degree} className="border-t border-border">
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td className="px-2 py-1">{c.degree}</td>
                  <td className="px-2 py-1">
                    {kindLabel(c.before.kind)}
                    {c.before.label ? ` (${c.before.label})` : ""} · {c.before.counted ? "counts" : "not counted"}
                  </td>
                  <td className="px-2 py-1">
                    {kindLabel(c.after.kind)}
                    {c.after.label ? ` (${c.after.label})` : ""} · <b>{c.after.counted ? "counts" : "not counted"}</b>
                  </td>
                  <td className="px-2 py-1 tabular">{c.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Students, attendance marks, internships and registration-pending periods are never changed. Percentages update as soon as the calendar changes.</p>
    </div>
  );
}
