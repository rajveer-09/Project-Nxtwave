/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SearchField } from "@/common/components/search-field";
import { STANDING_LABEL, type Standing } from "@/common/domain/standing";
import { formatDate } from "@/common/lib/dates";
import { searchMatcher } from "@/common/lib/search";
import { cn } from "@/common/lib/utils";

/**
 * The two tables at the foot of the evaluation dashboard, laid out as in the Instructor Evaluation app:
 * a searchable table (two thirds) and, beside it, the detail of the row you clicked.
 */

const ATTENDANCE_MIN = 75;

const num = (value: number, tone?: "good" | "warn") => (
  <span className={cn("tabular", value === 0 ? "text-muted-foreground/60" : tone === "good" ? "text-accent-strong" : tone === "warn" ? "text-warning" : "")}>{value}</span>
);
const att = (value: number | null) =>
  value === null ? <span className="text-muted-foreground/60">—</span> : <span className={cn("tabular", value < ATTENDANCE_MIN && "font-semibold text-warning")}>{value}%</span>;

const th = "px-3 py-2 text-right font-medium";
const td = "px-3 py-2 text-right";
/** The name column stays in place while the rest of a wide table scrolls sideways (phones, tablets). */
const stickyHead = "sticky left-0 z-20 bg-surface-subtle px-3 py-2 text-left font-medium";
const stickyCell = (selected: boolean) =>
  cn("sticky left-0 z-[1] max-w-44 px-3 py-2 text-left font-medium group-hover:bg-surface-subtle group-focus-visible:bg-surface-subtle sm:max-w-none", selected ? "bg-surface-subtle" : "bg-card");
/** Table and detail sit side by side from this width; below it the detail is under the table. */
const SIDE_BY_SIDE = "(min-width: 80rem)";

function Panel({ title, action, className, children, id }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 rounded-xl border border-border bg-card p-3.5 sm:p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Detail({ rows, empty }: { rows: [string, React.ReactNode][] | null; empty: string }) {
  if (!rows) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <dl className="grid gap-x-8 gap-y-2.5 text-[13px] sm:grid-cols-2 xl:grid-cols-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-muted pb-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A row you can click, or reach with Tab and open with Enter / Space. */
function rowProps(selected: boolean, onSelect: () => void) {
  return {
    tabIndex: 0,
    "aria-current": selected || undefined,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    className: cn(
      "group cursor-pointer border-b border-muted outline-none last:border-0 hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
      selected && "bg-surface-subtle",
    ),
  };
}

// ---------------------------------------------------------------- instructors

export type InstructorRow = {
  name: string;
  today: number;
  last3: number;
  last7: number;
  inRange: number;
  cleared: number;
  revisits: number;
  /** Students assigned to them now, and those students' average attendance over the last 30 days. */
  students: number;
  attendance: number | null;
};

/** Interactions each instructor took: today, last 3 and 7 days, the chosen dates, all-time outcomes, and their students' attendance. */
export function InstructorMetrics({ rows }: { rows: InstructorRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  const select = (key: string) => {
    setSelected(key);
    // Below the side-by-side width the detail is under the table: bring it into view.
    if (!window.matchMedia(SIDE_BY_SIDE).matches) requestAnimationFrame(() => document.getElementById(detailId)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const match = searchMatcher(query);
  const shown = rows.filter((r) => match(r.name));
  const detail = rows.find((r) => r.name === selected) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Instructor metrics" className="xl:col-span-2" action={<SearchField label="Search instructor" value={query} onChange={setQuery} className="w-full sm:w-56" />}>
        <div className="max-h-80 overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-[13px]">
            <caption className="sr-only">Interactions per instructor; select a row for details</caption>
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-xs text-muted-foreground">
              <tr>
                <th scope="col" className={stickyHead}>Instructor</th>
                <th scope="col" className={th}>Today</th>
                <th scope="col" className={th}>Last 3 days</th>
                <th scope="col" className={th}>Last 7 days</th>
                <th scope="col" className={th}>Cleared</th>
                <th scope="col" className={th}>Revisits</th>
                <th scope="col" className={th}>Students&apos; attendance</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((r) => (
                  <tr key={r.name} {...rowProps(selected === r.name, () => select(r.name))}>
                    <th scope="row" className={stickyCell(selected === r.name)}>{r.name}</th>
                    <td className={td}>{num(r.today)}</td>
                    <td className={td}>{num(r.last3)}</td>
                    <td className={td}>{num(r.last7)}</td>
                    <td className={td}>{num(r.cleared, "good")}</td>
                    <td className={td}>{num(r.revisits, "warn")}</td>
                    <td className={td}>{att(r.attendance)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">No instructor matches your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Selected instructor detail" id={detailId}>
        <Detail
          empty="Click an instructor row to view daily, 3-day and 7-day metrics."
          rows={
            detail && [
              ["Name", detail.name],
              ["Interactions today", num(detail.today)],
              ["Interactions last 3 days", num(detail.last3)],
              ["Interactions last 7 days", num(detail.last7)],
              ["Interactions in these dates", num(detail.inRange)],
              ["Cleared sessions", num(detail.cleared, "good")],
              ["Revisit sessions", num(detail.revisits, "warn")],
              ["Students assigned", num(detail.students)],
              ["Their attendance · 30 days", att(detail.attendance)],
            ]
          }
        />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- students

export type StudentRow = {
  niatId: string;
  name: string;
  college: string;
  instructor: string;
  level: number;
  standing: Standing;
  interactions: number;
  cleared: number;
  revisits: number;
  last: string | null;
  attendance30d: number | null;
  attendanceTerm: number | null;
};

/** Every student's interactions (all time), most first, with their attendance; a row shows its detail beside. */
export function StudentInteractions({ rows }: { rows: StudentRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  const select = (key: string) => {
    setSelected(key);
    // Below the side-by-side width the detail is under the table: bring it into view.
    if (!window.matchMedia(SIDE_BY_SIDE).matches) requestAnimationFrame(() => document.getElementById(detailId)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const match = searchMatcher(query);
  const shown = rows.filter((r) => match(r.name, r.niatId));
  const detail = rows.find((r) => r.niatId === selected) ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel title="Student interaction analytics" className="xl:col-span-2" action={<SearchField label="Search name or NIAT ID" value={query} onChange={setQuery} className="w-full sm:w-56" />}>
        <div className="max-h-80 overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-[13px]">
            <caption className="sr-only">Interactions and attendance per student; select a row for details</caption>
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-xs text-muted-foreground">
              <tr>
                <th scope="col" className={stickyHead}>Student</th>
                <th scope="col" className={th}>Interactions</th>
                <th scope="col" className={th}>Cleared</th>
                <th scope="col" className={th}>Revisits</th>
                <th scope="col" className={th}>Attendance</th>
                <th scope="col" className={th}>Last</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((r) => (
                  <tr key={r.niatId} {...rowProps(selected === r.niatId, () => select(r.niatId))}>
                    <th scope="row" className={stickyCell(selected === r.niatId)}>{r.name}</th>
                    <td className={td}>{num(r.interactions)}</td>
                    <td className={td}>{num(r.cleared, "good")}</td>
                    <td className={td}>{num(r.revisits, "warn")}</td>
                    <td className={td}>{att(r.attendance30d)}</td>
                    <td className={cn(td, "whitespace-nowrap tabular")}>{r.last ? formatDate(r.last) : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No student matches your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Selected student detail" id={detailId}>
        <Detail
          empty="Click a student row to view interaction count, attendance and status."
          rows={
            detail && [
              ["Name", detail.name],
              ["Student ID", <span key="id" className="tabular">{detail.niatId}</span>],
              ["College", detail.college],
              ["Instructor", detail.instructor || "—"],
              ["Level", `L${detail.level}`],
              ["Total interactions", num(detail.interactions)],
              ["Cleared", num(detail.cleared, "good")],
              ["Revisits", num(detail.revisits, "warn")],
              ["Last interaction", detail.last ? formatDate(detail.last) : "—"],
              ["Attendance · 30 days", att(detail.attendance30d)],
              ["Attendance · this term", att(detail.attendanceTerm)],
              ["Current status", STANDING_LABEL[detail.standing]],
            ]
          }
        />
        {detail ? (
          <Link href={`/students/${detail.niatId}`} className="mt-3 flex min-h-10 items-center text-[13px] font-semibold text-primary hover:text-accent-strong">
            Open {detail.name.split(" ")[0]}&apos;s page and history →
          </Link>
        ) : null}
      </Panel>
    </div>
  );
}
