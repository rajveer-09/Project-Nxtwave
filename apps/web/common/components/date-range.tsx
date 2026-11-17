/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useRef, useState } from "react";
import { addDays } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";

/**
 * Date range for any data view: quick ranges (7 / 30 / 90 days, this month) or custom from–to.
 * Lives inside a <LiveForm>: its two date fields are named "from" and "to", and picking a quick
 * range fills them and applies the form.
 */
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function DateRange({ from, to, today, max = 400 }: { from: string; to: string; today: string; max?: number }) {
  const [range, setRange] = useState({ from, to });
  const root = useRef<HTMLDivElement>(null);
  const presets = [
    { label: "7 days", from: addDays(today, -6), to: today },
    { label: "30 days", from: addDays(today, -29), to: today },
    { label: "90 days", from: addDays(today, -89), to: today },
    { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
  ];
  const pick = (next: { from: string; to: string }) => {
    setRange(next);
    // Let the inputs take the new values, then apply the form they belong to.
    requestAnimationFrame(() => root.current?.closest("form")?.requestSubmit());
  };
  return (
    <div ref={root} className="flex flex-wrap items-end gap-2">
      <div role="group" aria-label="Quick ranges" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {presets.map((p) => {
          const on = p.from === range.from && p.to === range.to;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => pick(p)}
              className={cn("h-8 rounded-md px-2.5 text-xs font-semibold transition-colors", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <input
          type="date"
          name="from"
          value={range.from}
          max={range.to}
          min={addDays(range.to, -max)}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <input type="date" name="to" value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={field} />
      </label>
    </div>
  );
}
