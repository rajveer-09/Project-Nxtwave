/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { useState } from "react";
import { cn } from "@/common/lib/utils";

export type TimelineEvent = { date: string; module: "attendance" | "interactions" | "tests" | "contests"; title: string; detail: string };

const MODULES = {
  attendance: ["DSA attendance", "bg-accent text-accent-strong"],
  interactions: ["Interaction", "bg-muted text-sidebar-foreground"],
  tests: ["Weekly test", "bg-warning-soft text-warning"],
  contests: ["Contest", "bg-[#EDE9FE] dark:bg-[#2E1F5E] text-[#5B21B6] dark:text-[#C4B5FD]"],
} as const;

const FILTERS = [["all", "All"], ["attendance", "DSA attendance"], ["interactions", "Interactions"], ["tests", "Weekly tests"], ["contests", "Contests"]] as const;

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const shown = events.filter((e) => filter === "all" || e.module === filter);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Filter timeline" className="flex flex-wrap gap-1.5">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-[13px] font-semibold",
              filter === key ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ol className="rounded-xl border border-border bg-card">
        {shown.map((e, i) => (
          <li key={`${e.date}-${i}`} className="flex items-start gap-3.5 border-b border-muted px-5 py-3 last:border-b-0">
            <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground">{e.date}</span>
            <span className={cn("min-w-[84px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-bold", MODULES[e.module][1])}>
              {MODULES[e.module][0]}
            </span>
            <span className="min-w-0 flex-1 text-[13px]">
              <span className="font-semibold">{e.title}</span>
              {e.detail ? <span className="text-muted-foreground"> · {e.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
