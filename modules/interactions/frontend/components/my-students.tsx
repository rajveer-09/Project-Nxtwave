/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";
import { STANDING_HINT, STANDING_LABEL, STANDINGS, type Standing } from "@/common/domain/standing";
import { cn } from "@/common/lib/utils";

export type MyStudent = {
  niatId: string;
  name: string;
  section: string;
  level: number;
  topic: string;
  standing: Standing;
  lastInteractionDays: number | null;
  overdue: boolean;
};

const DOT: Record<Standing, string> = {
  pending: "bg-muted-foreground/60",
  in_progress: "bg-chart-4",
  revisit: "bg-destructive",
  cleared: "bg-primary",
};

type Filter = "all" | "overdue" | Standing;

const last = (days: number | null) => (days === null ? "Never" : days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`);

/**
 * Everyone assigned to this instructor, so they can pick who to log next: overdue first, then by
 * name. "Log" opens the Log interaction page for that student.
 */
export function MyStudents({ students, overdueDays }: { students: MyStudent[]; overdueDays: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: students.length, overdue: 0, pending: 0, in_progress: 0, revisit: 0, cleared: 0 };
    for (const s of students) {
      c[s.standing] += 1;
      if (s.overdue) c.overdue += 1;
    }
    return c;
  }, [students]);

  const shown = useMemo(() => {
    const match = searchMatcher(query);
    return students
      .filter((s) => (filter === "all" ? true : filter === "overdue" ? s.overdue : s.standing === filter))
      .filter((s) => match(s.name, s.niatId, s.topic))
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (b.lastInteractionDays ?? 1e9) - (a.lastInteractionDays ?? 1e9) || a.name.localeCompare(b.name));
  }, [students, query, filter]);

  const chips: { key: Filter; label: string; hint?: string }[] = [
    { key: "all", label: "All" },
    { key: "overdue", label: "Overdue", hint: `No interaction in ${overdueDays}+ days` },
    ...STANDINGS.map((s) => ({ key: s, label: STANDING_LABEL[s], hint: STANDING_HINT[s] })),
  ];

  return (
    <section aria-labelledby="my-students-h" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-col">
          <h2 id="my-students-h" className="text-base font-semibold">
            My students
          </h2>
          <span className="text-xs text-muted-foreground">Pick who to log next. Standing is at each student&apos;s current level.</span>
        </div>
        <SearchField label="Search my students" placeholder="Name, NIAT ID or topic" value={query} onChange={setQuery} className="w-full sm:w-64" />
      </div>
      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5 px-5 pt-3">
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              title={c.hint}
              disabled={c.key !== "all" && counts[c.key] === 0}
              onClick={() => setFilter(c.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold disabled:opacity-40",
                on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-sidebar-foreground hover:bg-muted",
                c.key === "overdue" && !on && counts.overdue ? "border-warning-border text-warning" : "",
              )}
            >
              {c.key !== "all" && c.key !== "overdue" ? <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[c.key])} /> : null}
              {c.label}
              <span className="tabular opacity-70">{counts[c.key]}</span>
            </button>
          );
        })}
      </div>
      {shown.length ? (
        <div className="mt-2 max-h-[420px] overflow-auto px-5 pb-3">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">My students</caption>
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-left text-xs text-muted-foreground">
                {["Student", "Level · topic", "Standing", "Last interaction", ""].map((h, i) => (
                  <th key={i} scope="col" className="border-b border-border bg-card py-2 pr-3 font-semibold last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                return (
                  <tr key={s.niatId}>
                    <td className="border-b border-muted py-2 pr-3">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {s.niatId} · {s.section}
                      </div>
                    </td>
                    <td className="border-b border-muted py-2 pr-3 text-sidebar-foreground">
                      Level {s.level} · {s.topic}
                    </td>
                    <td className="border-b border-muted py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5" title={STANDING_HINT[s.standing]}>
                        <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[s.standing])} />
                        {STANDING_LABEL[s.standing]}
                      </span>
                    </td>
                    <td className={cn("border-b border-muted py-2 pr-3 whitespace-nowrap", s.overdue ? "font-semibold text-warning" : "text-sidebar-foreground")}>
                      {last(s.lastInteractionDays)}
                    </td>
                    <td className="border-b border-muted py-2 text-right">
                      <Link
                        href={`/log-interaction?niat=${s.niatId}`}
                        className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        aria-label={`Log an interaction for ${s.name}`}
                      >
                        Log
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-[13px] text-muted-foreground">{students.length ? "No students match." : "No students are assigned to you yet."}</p>
      )}
    </section>
  );
}
