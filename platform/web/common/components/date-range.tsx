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
 * Date range for any data view: Today, or Custom from–to. Lives inside a <LiveForm>: its two date
 * fields are named "from" and "to" (hidden, but still sent, while Today is chosen), and picking
 * Today fills them and applies the form.
 */
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const tab = (on: boolean) =>
  cn("h-8 rounded-md px-3 text-xs font-semibold transition-colors", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

export function DateRange({ from, to, today, max = 400 }: { from: string; to: string; today: string; max?: number }) {
  const [range, setRange] = useState({ from, to });
  const [custom, setCustom] = useState(!(from === today && to === today));
  const root = useRef<HTMLDivElement>(null);
  const fromInput = useRef<HTMLInputElement>(null);

  const pickToday = () => {
    setCustom(false);
    setRange({ from: today, to: today });
    // Let the inputs take the new values, then apply the form they belong to.
    requestAnimationFrame(() => root.current?.closest("form")?.requestSubmit());
  };
  const pickCustom = () => {
    setCustom(true);
    requestAnimationFrame(() => fromInput.current?.focus());
  };

  return (
    <div ref={root} className="flex flex-wrap items-end gap-2">
      <div role="group" aria-label="Dates" className="flex gap-1 rounded-lg bg-muted p-1">
        <button type="button" aria-pressed={!custom} onClick={pickToday} className={tab(!custom)}>
          Today
        </button>
        <button type="button" aria-pressed={custom} onClick={pickCustom} className={tab(custom)}>
          Custom
        </button>
      </div>
      <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", !custom && "hidden")}>
        From
        <input
          ref={fromInput}
          type="date"
          name="from"
          value={range.from}
          max={range.to}
          min={addDays(range.to, -max)}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className={field}
        />
      </label>
      <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", !custom && "hidden")}>
        To
        <input type="date" name="to" value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={field} />
      </label>
    </div>
  );
}
