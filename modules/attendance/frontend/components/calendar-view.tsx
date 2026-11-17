/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { Skeleton } from "@/common/ui/skeleton";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { CalendarDay } from "@nxtone/attendance-ui/types";
import { cn } from "@/common/lib/utils";

const KIND: Record<CalendarDay["kind"], { label: string; cls: string }> = {
  working: { label: "Working day", cls: "bg-card border-border" },
  sunday: { label: "Sunday", cls: "bg-muted border-muted text-muted-foreground" },
  holiday: { label: "Holiday", cls: "bg-[#F0F2F5] dark:bg-[#232731] border-[#D5D8DF] dark:border-[#343A47]" },
  exam: { label: "Exam", cls: "bg-warning-soft border-warning-border" },
  exam_prep: { label: "Exam preparation", cls: "bg-[#FFF3D6] dark:bg-[#2E2410] border-[#F0D9A0] dark:border-[#6B5420]" },
  event: { label: "Event", cls: "bg-accent border-accent-border" },
};

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** Read-only academic calendar (editing calendar entries comes in the next attendance pass). */
export function CalendarView({ today }: { today: string }) {
  const [ym, setYm] = useState(today.slice(0, 7));
  const [view, setView] = useState("ALL");
  const q = useQuery({ queryKey: ["attendance", "calendar", ym, view], queryFn: () => attendanceApi.calendar(ym, view) });
  const days = q.data?.days ?? [];
  const lead = days.length ? (days[0].weekday + 6) % 7 : 0; // Monday-first grid

  return (
    <section aria-label="Academic calendar" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setYm(shiftMonth(ym, -1))} className="flex size-10 items-center justify-center rounded-lg border border-input hover:bg-muted">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <h2 className="min-w-44 text-center text-lg font-semibold" aria-live="polite">
            {monthLabel(ym)}
          </h2>
          <button type="button" aria-label="Next month" onClick={() => setYm(shiftMonth(ym, 1))} className="flex size-10 items-center justify-center rounded-lg border border-input hover:bg-muted">
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          Show the calendar for
          <select value={view} onChange={(e) => setView(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground">
            {(q.data?.applies_to ?? ["ALL", "BITS", "CDU"]).map((v) => (
              <option key={v} value={v}>
                {v === "ALL" ? "Everyone" : v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-96" />
      ) : q.isError ? (
        <EmptyState title="Couldn't load the calendar" description={q.error.message} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol aria-label={`${monthLabel(ym)} calendar`} className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: lead }, (_, i) => (
              <li key={`lead${i}`} aria-hidden="true" />
            ))}
            {days.map((d) => {
              const k = KIND[d.kind];
              const day = Number(d.date.slice(8));
              return (
                <li
                  key={d.date}
                  className={cn(
                    "flex min-h-20 flex-col gap-0.5 rounded-lg border p-1.5 text-left text-xs",
                    k.cls,
                    !d.in_term && "opacity-50",
                    d.date === today && "ring-2 ring-primary",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{day}</span>
                    {d.in_term && d.kind !== "sunday" && d.date <= today ? (
                      <span className={cn("text-[10px] font-bold", d.counted ? "text-accent-strong" : "text-muted-foreground")}>{d.counted ? "counts" : "no count"}</span>
                    ) : null}
                  </span>
                  {d.kind !== "working" ? <span className="font-semibold text-sidebar-foreground">{d.label || k.label}</span> : null}
                  {d.applies_to && d.applies_to !== "ALL" ? <span className="text-[10px] text-muted-foreground">{d.applies_to} only</span> : null}
                  <span className="sr-only">{`${d.date}: ${d.label || k.label}${d.in_term ? "" : ", outside the term"}${d.counted ? ", counts for attendance" : ""}`}</span>
                </li>
              );
            })}
          </ol>
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(Object.keys(KIND) as CalendarDay["kind"][]).map((kind) => (
              <li key={kind} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded-sm border", KIND[kind].cls)} />
                {KIND[kind].label}
              </li>
            ))}
            <li>Faded: outside the term</li>
          </ul>
        </>
      )}
    </section>
  );
}
