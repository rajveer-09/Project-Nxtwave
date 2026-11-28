/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/common/ui/popover";
import { cn } from "@/common/lib/utils";
import { DateRangeCard } from "@nxtone/attendance-ui/components/students/date-range";
import {
  CATEGORY_INFO,
  fmtDate,
  fmtDay,
  fmtMonth,
  inputClass,
  NOTICE,
  PctBadge,
  pctText,
  PERIOD_STATE_LABEL,
  PeriodDates,
  selectClass,
  TermRange,
} from "@nxtone/attendance-ui/components/students/ui";
import type { MonthDay, Period, PeriodKind, Placement, Profile, ProfileStudent, RangeResult, StudentMonth } from "@nxtone/attendance-ui/types";

/*
 * One student's attendance, as the student sees it, plus whatever admin extras the page passes in
 * (extra header fields, remark editing, the internship card). Every number comes from the service.
 */

function Card({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold">{title}</h2>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StudentProfile({
  p,
  fetchMonth,
  fetchRange,
  extraFields = [],
  onSaveRemark,
  periodsCard,
}: {
  p: Profile;
  fetchMonth: (ym: string) => Promise<StudentMonth>;
  fetchRange: (from: string, to: string) => Promise<RangeResult>;
  extraFields?: { label: string; value: string }[];
  onSaveRemark?: (ym: string, remark: string) => Promise<unknown>;
  periodsCard?: React.ReactNode;
}) {
  const [month, setMonth] = useState("");
  const ym = month || p.months.at(-1)?.month || p.today.slice(0, 7);
  const history = useQuery({ queryKey: ["attendance", "student-month", p.student.niat_id, ym], queryFn: () => fetchMonth(ym) });
  const s = p.student;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Student" className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{s.name}</h2>
          <p className="font-mono text-[13px] text-muted-foreground">{s.niat_id}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-4">
            <Field label="Degree" value={s.degree} />
            <Field label="Section" value={s.section} />
            <Field label="Hall" value={s.hall_no || "–"} />
            <Field label="POC" value={s.poc || "Not assigned"} />
            <Field label="Success coach" value={s.coach || "Not assigned"} />
            {extraFields.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            {p.term ? <TermRange term={p.term} /> : "No current term"} · data up to {fmtDay(p.term && p.term.end < p.today ? p.term.end : p.today)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Attendance</span>
          <span className="text-5xl font-semibold text-primary tabular">{pctText(p.summary.pct)}</span>
          <TargetLine placement={p.placement} />
        </div>
      </section>

      <PlacementCautions p={p} onSaveRemark={onSaveRemark} />

      {periodsCard ?? <PeriodsCard periods={p.periods} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Working days so far" value={p.summary.marked_days} note="present + absent" />
        <Tile label="Days present" value={p.summary.days_attended} tone="text-emerald-700 dark:text-emerald-400" />
        <Tile label="Days absent" value={p.summary.days_absent} tone="text-red-700 dark:text-red-400" />
      </div>

      <DateRangeCard niatId={s.niat_id} today={p.today} term={p.term} fetchRange={fetchRange} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Monthly summary" description="Select a month to see its calendar." className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Attendance by month</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-2 font-semibold">Month</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Days</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Present</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Absent</th>
                  <th scope="col" className="pb-2 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {p.months.map((m) => (
                  <tr key={m.month} onClick={() => setMonth(m.month)} className={cn("cursor-pointer border-t border-border", m.month === ym ? "bg-accent font-semibold" : "hover:bg-muted")}>
                    <td className="py-2">
                      <button type="button" className="text-left hover:underline" aria-pressed={m.month === ym} onClick={() => setMonth(m.month)}>
                        {fmtMonth(m.month)}
                      </button>
                    </td>
                    <td className="py-2 text-right tabular">{m.marked_days}</td>
                    <td className="py-2 text-right tabular">{m.days_attended}</td>
                    <td className="py-2 text-right tabular">{m.days_absent}</td>
                    <td className="py-2 text-right">
                      <PctBadge pct={m.pct} band={m.band} />
                    </td>
                  </tr>
                ))}
                {p.months.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-2 text-muted-foreground">
                      No months in the term yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Attendance calendar"
          description={fmtMonth(ym)}
          className="lg:col-span-3"
          action={
            p.months.length > 0 ? (
              <select value={ym} onChange={(e) => setMonth(e.target.value)} className={selectClass} aria-label="Month">
                {p.months.map((m) => (
                  <option key={m.month} value={m.month}>
                    {fmtMonth(m.month)}
                  </option>
                ))}
              </select>
            ) : null
          }
        >
          <Legend />
          <CategoryLegend days={history.data?.days ?? []} />
          <p className="text-xs text-muted-foreground">Hover over or tap a date to see what was on that day.</p>
          {history.error ? (
            <p className={NOTICE.error}>Couldn&apos;t load this month: {history.error.message}</p>
          ) : (
            <MonthCalendar days={history.data?.days ?? []} today={history.data?.today ?? p.today} degree={s.degree} periods={p.periods} />
          )}
        </Card>
      </div>
    </div>
  );
}

const MARK_CHIP = {
  P: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900",
  A: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900",
} as const;

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={cn("inline-flex min-w-7 justify-center rounded-md px-2 py-0.5 font-semibold ring-1 ring-inset", MARK_CHIP.P)}>P</span> P – Present
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn("inline-flex min-w-7 justify-center rounded-md px-2 py-0.5 font-semibold ring-1 ring-inset", MARK_CHIP.A)}>A</span> A – Absent
      </span>
    </p>
  );
}

function nonCountedText(d: MonthDay) {
  if (d.label) return d.label;
  if (d.kind === "sunday") return "Sunday";
  if (d.kind === "holiday") return "Holiday";
  if (d.kind === "exam_prep") return "Exam preparation";
  if (d.kind === "exam") return "Exam";
  if (d.excluded === "before_join") return "Before joining";
  if (d.excluded === "after_drop") return "After dropping";
  if (d.excluded === "outside_term") return "Outside semester";
  return "Not counted";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One month as a Monday-first grid. Hovering or tapping a date shows its details. */
function MonthCalendar({ days, today, degree, periods }: { days: MonthDay[]; today: string; degree: string; periods: Period[] }) {
  if (days.length === 0) return <p className="text-[13px] text-muted-foreground">Loading…</p>;
  const lead = (days[0].weekday + 6) % 7;
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {WEEKDAYS.map((w) => (
        <div key={w} className="pb-1 font-semibold text-muted-foreground">
          {w}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`lead-${i}`} />
      ))}
      {days.map((d) => {
        const future = d.date > today;
        const mark = d.counted && !future ? d.status : null;
        const note = d.counted ? "" : nonCountedText(d);
        const cat = d.category ? CATEGORY_INFO[d.category] : null;
        // A category colours the day when its mark counts (or will, for a planned internship day).
        const catTone = cat && (mark || (future && d.counted));
        return (
          <Popover key={d.date}>
            <PopoverTrigger
              openOnHover
              delay={200}
              closeDelay={80}
              render={
                <button
                  type="button"
                  aria-label={`${fmtDay(d.date)}${cat ? `, ${cat.label}` : ""}${mark ? `, ${mark === "P" ? "Present" : "Absent"}` : note ? `, ${note}` : ""}. Show details`}
                  className={cn(
                    "flex min-h-14 w-full cursor-pointer flex-col items-center justify-start gap-0.5 rounded-md p-1 ring-1 ring-inset hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none data-[popup-open]:ring-2 data-[popup-open]:ring-primary",
                    catTone ? cat.cls : mark ? MARK_CHIP[mark] : d.counted ? "bg-card ring-border" : "bg-muted/60 text-muted-foreground ring-transparent",
                    future && "opacity-50",
                    d.date === today && "outline-2 outline-primary",
                  )}
                />
              }
            >
              <span className="font-semibold tabular">{Number(d.date.slice(8))}</span>
              {mark ? <span className="text-sm font-bold">{mark}</span> : null}
              {cat ? <span className="line-clamp-2 text-[10px] leading-tight font-semibold">{cat.short}</span> : null}
              {note && !cat ? <span className="line-clamp-2 text-[10px] leading-tight">{note}</span> : null}
            </PopoverTrigger>
            <PopoverContent side="top" className="flex max-h-[min(70vh,30rem)] w-[min(20rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto">
              <DayDetails d={d} degree={degree} periods={periods} today={today} />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

const KIND_INFO: Record<string, { label: string; dot: string }> = {
  working: { label: "Working day", dot: "bg-emerald-500" },
  holiday: { label: "Holiday", dot: "bg-slate-400" },
  exam: { label: "Exam", dot: "bg-amber-500" },
  exam_prep: { label: "Exam preparation", dot: "bg-rose-500" },
  event: { label: "Event", dot: "bg-blue-500" },
  sunday: { label: "Sunday", dot: "bg-slate-300" },
};

const EXCLUSION_TEXT: Record<string, string> = {
  outside_term: "Outside the semester, so it does not count.",
  before_join: "Before the student joined, so it does not count.",
  after_drop: "After the student was dropped, so it does not count.",
};

const longDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekdayName = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });

/** One day of the student's calendar: what kind of day it was, whether it counts, and the mark. */
function DayDetails({ d, degree, periods, today }: { d: MonthDay; degree: string; periods: Period[]; today: string }) {
  const future = d.date > today;
  const mark = d.counted && !future ? d.status : null;
  const cat = d.category ? CATEGORY_INFO[d.category] : null;
  const period = d.category ? periods.find((p) => p.kind === d.category && p.state !== "cancelled" && p.start <= d.date && d.date <= p.end) : undefined;
  const info = KIND_INFO[d.kind] ?? KIND_INFO.working;
  const title = d.label || (d.kind === "working" ? "Class day" : d.kind === "sunday" ? "Sunday off" : info.label);
  const scope = d.applies_to === "ALL" ? "All degrees" : d.applies_to ? `${d.applies_to} only` : "";
  const detail = [d.label ? info.label : "", scope ? `Applies to: ${scope}` : d.kind === "working" ? "Default: Monday to Saturday" : ""].filter(Boolean);
  const [countDot, countText, countCls] = future
    ? ["bg-slate-300", "Future date", "text-muted-foreground"]
    : d.counted
      ? ["bg-emerald-500", "Counts", "text-emerald-700 dark:text-emerald-400"]
      : ["bg-slate-300", "Not counted", "text-muted-foreground"];
  const date = new Date(d.date + "T00:00:00Z");
  return (
    <>
      <header className="flex flex-col">
        <span className="text-xs text-muted-foreground">{weekdayName.format(date)}</span>
        <span className="text-[15px] font-semibold">{longDate.format(date)}</span>
      </header>
      <div className="flex flex-col gap-1 rounded-md bg-surface-subtle px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{degree}</span>
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", countCls)}>
            <span className={cn("size-1.5 rounded-full", countDot)} aria-hidden="true" />
            {countText}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", info.dot)} aria-hidden="true" />
          <span className="leading-snug font-semibold break-words">{title}</span>
        </div>
        {detail.length > 0 ? <p className="pl-4 text-xs text-muted-foreground">{detail.join(" · ")}</p> : null}
      </div>
      {d.excluded && d.excluded !== "future" && EXCLUSION_TEXT[d.excluded] ? <p className="text-xs text-amber-700 dark:text-amber-400">{EXCLUSION_TEXT[d.excluded]}</p> : null}
      {(d.counted && !future) || cat ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Attendance</h3>
          {d.counted && !future ? (
            mark ? (
              <span className={cn("font-semibold", mark === "P" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{mark === "P" ? "Present" : "Absent"}</span>
            ) : (
              <span className="text-muted-foreground">Not marked: left out of the %</span>
            )
          ) : null}
          {cat ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", cat.dot)} aria-hidden="true" />
                <span className="font-semibold">{cat.label}</span>
                <span className="text-xs text-muted-foreground">counted as {cat.mark}</span>
              </div>
              {period ? (
                <span className="pl-4 text-xs text-muted-foreground">
                  {fmtDate(period.start)} – {fmtDate(period.end)}
                  {period.kind === "REGISTRATION_PENDING" ? (period.completed_on ? ` · completed by ${fmtDate(period.completed_on)}` : " · not completed yet") : ""}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CategoryLegend({ days }: { days: MonthDay[] }) {
  const kinds = [...new Set(days.map((d) => d.category).filter(Boolean))] as PeriodKind[];
  if (kinds.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-3 rounded-sm ring-1 ring-inset", CATEGORY_INFO[k].cls)} />
          {CATEGORY_INFO[k].label} (counted as {CATEGORY_INFO[k].mark})
        </span>
      ))}
    </p>
  );
}

/** Read-only list of internship and registration-pending periods (when no admin card is passed). */
function PeriodsCard({ periods }: { periods: Period[] }) {
  if (periods.length === 0) return null;
  return (
    <Card title="Internship and registration" description="Internship days count as Present; days with Term 5 registration pending count as Absent.">
      <PeriodList periods={periods} />
    </Card>
  );
}

/** One line per period: category, state and dates. */
export function PeriodList({ periods, actions }: { periods: Period[]; actions?: (p: Period) => React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-2 text-[13px]">
      {periods.map((p) => (
        <li key={p.id} className={cn("flex flex-col gap-1 rounded-lg border border-border p-2.5 sm:flex-row sm:items-center sm:justify-between", p.state === "cancelled" && "opacity-60")}>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", CATEGORY_INFO[p.kind].cls)}>{CATEGORY_INFO[p.kind].short}</span>
              <span className="text-xs font-semibold">{PERIOD_STATE_LABEL[p.state]}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              <PeriodDates p={p} />
            </span>
          </div>
          {actions?.(p)}
        </li>
      ))}
    </ul>
  );
}

/** The term against the 95% placement threshold, then each month with its remark. */
function PlacementCautions({ p, onSaveRemark }: { p: Profile; onSaveRemark?: (ym: string, remark: string) => Promise<unknown> }) {
  const pl = p.placement;
  return (
    <Card title="Placement cautions" description={`Placements need at least ${pl.threshold}% attendance, for the term and in every month.`}>
      {pl.pct === null ? (
        <p className={NOTICE.muted}>No attendance marked yet.</p>
      ) : pl.below ? (
        <p className={NOTICE.error}>
          <b>Caution:</b> attendance is below {pl.threshold}%. Placement eligibility will be affected if attendance stays below {pl.threshold}%.
        </p>
      ) : (
        <p className={NOTICE.success}>Attendance meets the {pl.threshold}% placement requirement.</p>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {pl.months.map((m) => (
          <MonthCaution key={m.month} m={m} threshold={pl.threshold} remark={p.remarks[m.month] ?? ""} onSave={onSaveRemark} />
        ))}
        {pl.months.length === 0 ? <li className="px-3 py-2 text-[13px] text-muted-foreground">No months in the term yet.</li> : null}
      </ul>
    </Card>
  );
}

function MonthCaution({ m, threshold, remark, onSave }: { m: Placement["months"][number]; threshold: number; remark: string; onSave?: (ym: string, remark: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(remark);
  const save = useMutation({ mutationFn: () => onSave!(m.month, text.trim()), onSuccess: () => setEditing(false) });
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-32 font-semibold">{fmtMonth(m.month)}</span>
        <PctBadge pct={m.pct} band={m.pct === null ? "none" : m.below ? "below_60" : "75_plus"} />
        {m.pct === null ? (
          <span className="text-xs text-muted-foreground">No marks</span>
        ) : m.below ? (
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">Below {threshold}%: caution</span>
        ) : (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">OK</span>
        )}
        {onSave && !editing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setText(remark);
              setEditing(true);
            }}
          >
            {remark ? "Edit remark" : "Add remark"}
          </Button>
        ) : null}
      </div>
      {remark && !editing ? (
        <p className="rounded bg-surface-subtle px-2 py-1 text-xs">
          <span className="font-semibold">Remark:</span> {remark}
        </p>
      ) : null}
      {editing ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <input
            className={inputClass}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Remark for ${fmtMonth(m.month)}, e.g. medical leave approved`}
            aria-label={`Remark for ${fmtMonth(m.month)}`}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : text.trim() ? "Save" : "Remove"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {save.error ? <span role="alert" className="text-xs text-red-700 dark:text-red-400">{save.error.message}</span> : null}
        </form>
      ) : null}
    </li>
  );
}

/** Admin-only header fields. */
export function adminFields(s: ProfileStudent): { label: string; value: string }[] {
  const out = [
    { label: "Level", value: s.level || "–" },
    { label: "Status", value: s.status === "dropped" ? "Dropped" : "Active" },
    { label: "Joined on", value: s.joined_on ? fmtDate(s.joined_on) : "Term start" },
  ];
  if (s.dropped_on) out.push({ label: "Dropped on", value: fmtDate(s.dropped_on) });
  if (s.demo) out.push({ label: "Data", value: "Demo (N99)" });
  return out;
}

/** Under the big %: how far the student is from the placement target (the gap comes from the service). */
function TargetLine({ placement: pl }: { placement: Placement }) {
  if (pl.gap === null) return <span className="text-xs text-muted-foreground">No marks yet</span>;
  if (pl.gap === 0) return <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{pl.threshold}% target achieved</span>;
  const gap = Number.isInteger(pl.gap) ? String(pl.gap) : pl.gap.toFixed(1);
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground tabular">{gap}%</span> more needed to reach {pl.threshold}%
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Tile({ label, value, tone = "text-foreground", note }: { label: string; value: number; tone?: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular", tone)}>{value}</div>
      {note ? <div className="mt-0.5 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}
