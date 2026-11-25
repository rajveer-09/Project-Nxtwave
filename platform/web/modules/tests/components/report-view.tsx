/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { StatusPill } from "@/common/components/chips";
import { Dropdown } from "@/common/components/dropdown";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";
import { cn } from "@/common/lib/utils";
import { daysText, pctText, progressText, tookTest, valueText, type AutoFill, type FormatField } from "@/modules/tests/types";
import type { ReportResult, ReportRow } from "@/modules/tests/report";

/*
 * The interactive half of a weekly test report: the student table (search, filter by result, sort)
 * and a report card per student. What's filtered on screen is what prints.
 */

const RESULT: Record<ReportResult, { label: string; tone: "accent" | "warning" | "neutral" }> = {
  pass: { label: "Passed", tone: "accent" },
  below: { label: "Below pass", tone: "warning" },
  incomplete: { label: "Incomplete", tone: "neutral" },
  absent: { label: "Absent", tone: "warning" },
  missing: { label: "Not entered", tone: "neutral" },
};

const FILTERS: { value: ReportResult | "all" | "attention"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pass", label: "Passed" },
  { value: "below", label: "Below pass" },
  { value: "incomplete", label: "Incomplete" },
  { value: "absent", label: "Absent" },
  { value: "missing", label: "Not entered" },
  { value: "attention", label: "Low attendance" },
];

type Sort = "name" | "total" | "semester" | "week" | "progress";
const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "total", label: "Score" },
  { value: "semester", label: "Semester attendance" },
  { value: "week", label: "Last week" },
  { value: "progress", label: "Roadmap progress" },
];

const low = (pct: number | null | undefined) => pct !== null && pct !== undefined && pct < 75;

function Change({ total, previous }: { total: number | null; previous: number | null }) {
  if (total === null || previous === null) return null;
  const d = total - previous;
  if (d === 0) return <span className="text-xs text-muted-foreground">same as last</span>;
  return (
    <span className={cn("text-xs font-semibold tabular", d < 0 ? "text-warning" : "text-primary")}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)} vs last
    </span>
  );
}

function Progress({ auto, wide }: { auto: AutoFill | null; wide?: boolean }) {
  const p = auto?.progress;
  if (!p) return <span className="text-muted-foreground">—</span>;
  return (
    <div className={cn("flex flex-col gap-1", wide ? "" : "min-w-44")}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted print:border print:border-border" aria-hidden>
          <div className="h-full rounded-full bg-primary print-exact" style={{ width: `${p.percent ?? 0}%` }} />
        </div>
        <span className="text-xs font-semibold tabular">{p.percent === null ? "—" : `${p.percent}%`}</span>
      </div>
      <span className={cn("text-xs text-muted-foreground", !wide && "max-w-56 truncate")} title={progressText(p)}>
        {progressText(p)}
      </span>
    </div>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted print:hidden"
    >
      <Printer aria-hidden className="size-4" />
      Print / save PDF
    </button>
  );
}

export function ReportView({ testId, rows, fields, max, passMark }: { testId: string; rows: ReportRow[]; fields: FormatField[]; max: number; passMark: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [cards, setCards] = useState(false);
  // Paper is white: print in the light theme even when the app is dark (also for Ctrl+P), then switch back.
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains("dark");
      html.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) html.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const match = searchMatcher(query);
  const columns = fields.filter((f) => f.column);
  const panel = fields.filter((f) => !f.column);

  const count = (v: (typeof FILTERS)[number]["value"]) =>
    v === "all" ? rows.length : v === "attention" ? rows.filter((r) => low(r.auto?.week.pct) || low(r.auto?.semester.pct)).length : rows.filter((r) => r.result === v).length;
  const key = (r: ReportRow): number => {
    // Missing values sort last whichever way.
    if (sort === "total") return r.total ?? -1;
    if (sort === "semester") return r.auto?.semester.pct ?? 101;
    if (sort === "week") return r.auto?.week.pct ?? 101;
    if (sort === "progress") return r.auto?.progress.percent ?? -1;
    return 0;
  };
  const shown = rows
    .filter((r) => match(r.name, r.niatId, r.section, r.instructor))
    .filter((r) =>
      filter === "all" ? true : filter === "attention" ? low(r.auto?.week.pct) || low(r.auto?.semester.pct) : r.result === filter,
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "semester" || sort === "week"
          ? key(a) - key(b) || a.name.localeCompare(b.name)
          : key(b) - key(a) || a.name.localeCompare(b.name),
    );

  return (
    <>
      <section aria-labelledby="students-h" className="overflow-hidden rounded-xl border border-border bg-card print:break-before-page print:border-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 print:px-0">
          <div>
            <h2 id="students-h" className="text-base font-semibold">
              Students
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {shown.length === rows.length ? `${rows.length} students` : `${shown.length} of ${rows.length} students`} · attendance and roadmap filled in automatically
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <SearchField label="Search students" placeholder="Name, NIAT ID, section" value={query} onChange={setQuery} className="w-60" />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Sort by
              <Dropdown value={sort} onValueChange={(v) => setSort(v as Sort)} options={SORTS} aria-label="Sort students by" className="w-52" />
            </label>
          </div>
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3 print:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "min-h-8 rounded-full border px-3 text-xs font-semibold",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
              )}
            >
              {f.label} <span className="tabular opacity-75">{count(f.value)}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-[13px] print:min-w-0 print:text-[11px]">
            <caption className="sr-only">Each student&apos;s result, attendance and roadmap progress</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2.5 pr-2 pl-5 print:pl-0">Student</th>
                <th scope="col" className="border-b border-border px-2 py-2.5">Result</th>
                <th scope="col" className="border-b border-border px-2 py-2.5">Total /{max}</th>
                {columns.map((f) => (
                  <th key={f.id} scope="col" className="border-b border-border px-2 py-2.5">
                    {f.label}
                    {f.type === "marks" ? ` /${f.max}` : ""}
                  </th>
                ))}
                <th scope="col" className="border-b border-border px-2 py-2.5">Semester</th>
                <th scope="col" className="border-b border-border px-2 py-2.5">Last week</th>
                <th scope="col" className="border-b border-border py-2.5 pr-5 pl-2">Roadmap progress</th>
              </tr>
            </thead>
            <tbody>
              {!shown.length ? (
                <tr>
                  <td colSpan={columns.length + 6} className="px-5 py-8 text-center text-muted-foreground">
                    No students match.
                  </td>
                </tr>
              ) : null}
              {shown.map((r) => (
                <tr key={r.niatId} className="break-inside-avoid">
                  <td className="border-b border-muted py-2.5 pr-2 pl-5 print:pl-0">
                    <a href={`/students/${r.niatId}`} className="font-semibold hover:text-primary">
                      {r.name}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      {r.niatId} · {r.section} ·{" "}
                      <a href={`/tests/${testId}/students/${r.niatId}`} className="font-semibold text-primary hover:text-accent-strong print:hidden">
                        Student report
                      </a>
                    </div>
                  </td>
                  <td className="border-b border-muted px-2 py-2.5">
                    <StatusPill tone={RESULT[r.result].tone}>{RESULT[r.result].label}</StatusPill>
                  </td>
                  <td className="border-b border-muted px-2 py-2.5">
                    <div className={cn("font-bold tabular", r.result === "below" && "text-warning")}>{r.total ?? "—"}</div>
                    <Change total={r.total} previous={r.previous} />
                  </td>
                  {columns.map((f) => (
                    <td key={f.id} className="border-b border-muted px-2 py-2.5 tabular">
                      {tookTest(r) ? valueText(f, r.values[f.id]) : "—"}
                    </td>
                  ))}
                  <td className="border-b border-muted px-2 py-2.5">
                    <div className={cn("font-semibold tabular", low(r.auto?.semester.pct) && "text-warning")}>{pctText(r.auto?.semester)}</div>
                    <div className="text-xs text-muted-foreground">{daysText(r.auto?.semester)}</div>
                  </td>
                  <td className="border-b border-muted px-2 py-2.5">
                    <div className={cn("font-semibold tabular", low(r.auto?.week.pct) && "text-warning")}>{pctText(r.auto?.week)}</div>
                    <div className="text-xs text-muted-foreground">{daysText(r.auto?.week)}</div>
                  </td>
                  <td className="border-b border-muted py-2.5 pr-5 pl-2">
                    <Progress auto={r.auto} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="cards-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h2 id="cards-h" className="text-base font-semibold">
              Student report cards
            </h2>
            <p className="text-[13px] text-muted-foreground">One card per student with every field, for sharing or printing. Follows the filter above.</p>
          </div>
          <button
            type="button"
            aria-expanded={cards}
            onClick={() => setCards((v) => !v)}
            className="flex h-10 items-center rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted"
          >
            {cards ? "Hide cards" : `Show ${shown.length} card${shown.length === 1 ? "" : "s"}`}
          </button>
        </div>
        {cards ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 print:break-before-page print:grid-cols-2">
            {shown.map((r) => (
              <article key={r.niatId} aria-label={r.name} className="flex break-inside-avoid flex-col gap-3 rounded-xl border border-border bg-card p-4">
                <header className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {r.niatId} · {r.section} · {r.college}
                    </p>
                    <p className="text-xs text-muted-foreground">Instructor: {r.instructor || "—"}</p>
                    <a href={`/tests/${testId}/students/${r.niatId}`} className="text-xs font-semibold text-primary hover:text-accent-strong print:hidden">
                      Student report (PDF)
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("font-heading text-2xl font-semibold tabular", r.result === "below" && "text-warning")}>
                      {r.total === null ? "—" : `${r.total}`}
                      <span className="text-sm text-muted-foreground"> / {max}</span>
                    </span>
                    <StatusPill tone={RESULT[r.result].tone}>{RESULT[r.result].label}</StatusPill>
                    <Change total={r.total} previous={r.previous} />
                  </div>
                </header>
                <dl className="grid grid-cols-2 gap-2 rounded-lg bg-background px-3 py-2.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Semester attendance</dt>
                    <dd className={cn("font-heading text-lg font-semibold tabular", low(r.auto?.semester.pct) && "text-warning")}>{pctText(r.auto?.semester)}</dd>
                    <dd className="text-muted-foreground">{daysText(r.auto?.semester)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last week</dt>
                    <dd className={cn("font-heading text-lg font-semibold tabular", low(r.auto?.week.pct) && "text-warning")}>{pctText(r.auto?.week)}</dd>
                    <dd className="text-muted-foreground">{daysText(r.auto?.week)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="mb-1 text-muted-foreground">Roadmap progress</dt>
                    <dd>
                      <Progress auto={r.auto} wide />
                    </dd>
                  </div>
                </dl>
                {tookTest(r) ? (
                  <dl className="flex flex-col gap-1.5 text-[13px]">
                    {[...columns, ...panel].map((f) => (
                      <div key={f.id} className={cn("flex gap-2", f.type === "long" ? "flex-col gap-0.5" : "justify-between")}>
                        <dt className="text-muted-foreground">
                          {f.label}
                          {f.type === "marks" ? ` /${f.max}` : ""}
                        </dt>
                        <dd className={cn("font-medium", f.type === "long" ? "whitespace-pre-wrap" : "text-right")}>{valueText(f, r.values[f.id])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[13px] text-muted-foreground">{r.result === "absent" ? "Did not take the test." : "Result not entered yet."}</p>
                )}
                {r.total !== null && r.total < passMark ? (
                  <p className="text-xs font-semibold text-warning">Scored under the pass mark of {passMark}.</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
