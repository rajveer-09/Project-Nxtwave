/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import type { OutcomeCounts } from "@/modules/analytics/evaluation";

const cellNum = (value: number, tone?: "good" | "warn" | "info", strong = false) => (
  <span
    className={cn(
      "tabular",
      value === 0 ? "text-muted-foreground/50" : tone === "good" ? "text-accent-strong" : tone === "warn" ? "text-warning" : tone === "info" ? "text-chart-4" : "",
      strong && value !== 0 && "font-semibold",
    )}
  >
    {value}
  </span>
);

// ---------------------------------------------------------------- level conversions

export type ConversionItem = { niatId: string; name: string; college: string; instructor: string; from: number; date: string };

/**
 * Students who moved up a level in the chosen dates, per boundary (L0 → L1, …) and college. Each row
 * opens the list of students. Below it, level changes that don't count yet.
 */
export function LevelConversions({ counted, notCounted, colleges, levels }: { counted: ConversionItem[]; notCounted: ConversionItem[]; colleges: string[]; levels: number }) {
  const boundaries = Array.from({ length: Math.max(1, levels - 1) }, (_, from) => from);
  const grid = "grid grid-cols-[minmax(6.5rem,1.4fr)_repeat(var(--cols),minmax(3rem,1fr))] items-center gap-2";
  const style = { "--cols": colleges.length + 1 } as React.CSSProperties;
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="min-w-[300px] text-[13px]">
          <div className={cn(grid, "border-b border-border bg-surface-subtle px-3 py-2 text-xs font-semibold text-muted-foreground")} style={style}>
            <span>Conversion</span>
            {[...colleges, "Total"].map((c) => (
              <span key={c} className="text-right">
                {c}
              </span>
            ))}
          </div>
          {boundaries.map((from) => {
            const items = counted.filter((c) => c.from === from).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
            const cells = (
              <>
                <span className="flex items-center gap-1.5 font-medium">
                  L{from} → L{from + 1}
                  {items.length ? <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" /> : null}
                </span>
                {colleges.map((c) => (
                  <span key={c} className="text-right">
                    {cellNum(items.filter((i) => i.college === c).length)}
                  </span>
                ))}
                <span className="text-right">
                  {cellNum(items.length, "good", true)}
                </span>
              </>
            );
            if (!items.length) {
              return (
                <div key={from} className={cn(grid, "border-b border-muted px-3 py-2 opacity-70")} style={style}>
                  {cells}
                </div>
              );
            }
            return (
              <details key={from} className="group border-b border-muted">
                <summary className={cn(grid, "cursor-pointer list-none px-3 py-2 hover:bg-surface-subtle [&::-webkit-details-marker]:hidden")} style={style}>
                  {cells}
                </summary>
                <PeopleTable items={items} dateLabel="Date cleared" />
              </details>
            );
          })}
          <div className={cn(grid, "px-3 py-2.5 font-semibold")} style={style}>
            <span>Total</span>
            {colleges.map((c) => (
              <span key={c} className="text-right tabular">
                {counted.filter((i) => i.college === c).length}
              </span>
            ))}
            <span className="text-right tabular">
              {counted.length}
            </span>
          </div>
        </div>
      </div>

      {notCounted.length ? (
        <details className="group rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-[13px]">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-warning [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
            Not counted: {notCounted.length} level change{notCounted.length === 1 ? "" : "s"} made before every topic of the level was cleared
          </summary>
          <PeopleTable items={notCounted} dateLabel="Last interaction before it" showChange />
        </details>
      ) : null}

      <p className="text-xs text-muted-foreground">
        From 13 Oct 2026, 4 PM, a conversion counts once every required topic of the level (set in Question Bank) has its own Cleared interaction, dated by the
        topic cleared last; a level changed before that is listed as not counted. Conversions from before then are dated by the last interaction before the
        promotion. A promotion that was undone isn&apos;t counted. Colleges and instructors are the current ones.
      </p>
    </div>
  );
}

function PeopleTable({ items, dateLabel, showChange }: { items: ConversionItem[]; dateLabel: string; showChange?: boolean }) {
  return (
    <div className="max-h-72 overflow-y-auto px-3 pb-3">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr>
            <th scope="col" className="py-1.5 pr-3 text-left font-medium">Student</th>
            <th scope="col" className="px-3 py-1.5 text-left font-medium">College</th>
            <th scope="col" className="px-3 py-1.5 text-left font-medium">Assigned instructor</th>
            {showChange ? <th scope="col" className="px-3 py-1.5 text-left font-medium">Level change</th> : null}
            <th scope="col" className="py-1.5 pl-3 text-right font-medium">{dateLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={`${c.niatId}-${c.from}`} className="border-t border-muted">
              <td className="py-1.5 pr-3">
                <Link href={`/students/${c.niatId}`} className="font-medium text-foreground hover:text-primary">
                  {c.name}
                </Link>
              </td>
              <td className="px-3 py-1.5">{c.college}</td>
              <td className="px-3 py-1.5">{c.instructor}</td>
              {showChange ? (
                <td className="px-3 py-1.5 whitespace-nowrap">
                  L{c.from} → L{c.from + 1}
                </td>
              ) : null}
              <td className="py-1.5 pl-3 text-right whitespace-nowrap tabular">{formatDate(c.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- daily overview

const OUTCOME_COLUMNS: { key: keyof OutcomeCounts; label: string; tone?: "good" | "warn" | "info" }[] = [
  { key: "students", label: "Students" },
  { key: "cleared", label: "Cleared", tone: "good" },
  { key: "revisit", label: "Revisit", tone: "warn" },
  { key: "inProgress", label: "In progress", tone: "info" },
];

const empty = (): OutcomeCounts => ({ students: 0, cleared: 0, revisit: 0, inProgress: 0 });
const add = (a: OutcomeCounts, b?: OutcomeCounts) => {
  if (b) for (const k of Object.keys(a) as (keyof OutcomeCounts)[]) a[k] += b[k];
  return a;
};

/**
 * Each day, per college: students interacted with and their outcome that day (the latest one when
 * seen more than once). Latest day first; quiet days show zeros.
 */
export function DailyByCollege({ days, colleges, cells, today }: { days: string[]; colleges: string[]; cells: Map<string, OutcomeCounts>; today: string }) {
  const groups = [...colleges, "Total"];
  const at = (day: string, college: string) => (college === "Total" ? colleges.reduce((acc, c) => add(acc, cells.get(`${day}|${c}`)), empty()) : cells.get(`${day}|${college}`) ?? empty());
  const totals = (college: string) => days.reduce((acc, day) => add(acc, at(day, college)), empty());
  const group = (counts: OutcomeCounts, strong = false) =>
    OUTCOME_COLUMNS.map((col, i) => (
      <td key={col.key} className={cn("px-2 py-1.5 text-right", i === 0 && "border-l border-border")}>
        {cellNum(counts[col.key], col.tone, strong || col.key === "students")}
      </td>
    ));

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[30rem] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <caption className="sr-only">Students interacted with each day, per college, by outcome</caption>
          <thead className="sticky top-0 z-10 bg-surface-subtle text-xs text-muted-foreground">
            <tr>
              <th rowSpan={2} scope="col" className="sticky left-0 z-20 bg-surface-subtle px-3 py-2 text-left font-semibold">
                Date
              </th>
              {groups.map((g) => (
                <th key={g} colSpan={4} scope="colgroup" className="border-l border-border px-2 pt-2 text-center font-semibold text-foreground">
                  {g}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border">
              {groups.map((g) =>
                OUTCOME_COLUMNS.map((col, i) => (
                  <th key={`${g}-${col.key}`} scope="col" className={cn("px-2 pb-2 text-right font-medium", i === 0 && "border-l border-border")}>
                    {col.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} className={cn("border-b border-muted", day === today && "bg-surface-subtle")}>
                <th scope="row" className={cn("sticky left-0 z-[1] px-3 py-1.5 text-left font-medium whitespace-nowrap tabular", day === today ? "bg-surface-subtle" : "bg-card")}>
                  {formatDate(day)}
                  {day === today ? <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">Today</span> : null}
                </th>
                {groups.map((g) => group(at(day, g)))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-surface-subtle font-semibold">
            <tr className="border-t border-border">
              <th scope="row" className="sticky left-0 z-[1] bg-surface-subtle px-3 py-2 text-left">
                Period total
              </th>
              {groups.map((g) => group(totals(g), true))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Period totals add up the days, so a student seen on two different days counts on both.</p>
    </div>
  );
}

// ---------------------------------------------------------------- colleges

export type CollegeCard = { college: string; students: number; interactions: number; today: number; cleared: number; revisit: number; attendance: number | null };

/** Per college: roster size, interactions in the dates and today, students cleared / to revisit and attendance in the dates. */
export function CollegeCards({ cards, attendanceMin = 75 }: { cards: CollegeCard[]; attendanceMin?: number }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {cards.map((c) => (
        <div key={c.college} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-subtle/60 p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{c.college}</span>
            <span className="text-xs text-muted-foreground">{c.students} students</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Total interactions", String(c.interactions), undefined],
              ["Today", String(c.today), undefined],
              ["Cleared", String(c.cleared), "text-accent-strong"],
              ["Revisit", String(c.revisit), "text-warning"],
              ["Attendance", c.attendance === null ? "—" : `${c.attendance}%`, c.attendance !== null && c.attendance < attendanceMin ? "text-warning" : undefined],
            ].map(([label, value, tone]) => (
              <div key={label} className="flex flex-col rounded-md border border-border bg-card px-2.5 py-2 last:col-span-2 sm:last:col-span-1">
                <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
                <dd className={cn("font-heading text-lg font-semibold tabular", tone)}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
