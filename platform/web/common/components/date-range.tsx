/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useRef, useState } from "react";
import { addDays, isRealDate } from "@/common/lib/dates";
import { useResetWhenShown } from "@/common/lib/use-reset-when-shown";
import { cn } from "@/common/lib/utils";

/**
 * Date range for any data view: quick ranges (Today by default), or Custom from–to. Lives inside a
 * <LiveForm>: its two date fields are named "from" and "to" (hidden, but still sent, while a quick
 * range is chosen), and picking a quick range fills them and applies the form.
 */
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const tab = (on: boolean) =>
  cn("h-8 rounded-md px-3 text-xs font-semibold transition-colors", on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

export type QuickRange = "Today" | "7 days" | "30 days" | "90 days" | "This month";

/** `quick` picks which quick ranges show before Custom, in this order: Today, 7 / 30 / 90 days, This month. Just Today when left out. */
export function DateRange({ from, to, today, max = 400, quick = ["Today"] }: { from: string; to: string; today: string; max?: number; quick?: QuickRange[] }) {
  const all: { label: QuickRange; from: string; to: string }[] = [
    { label: "Today", from: today, to: today },
    { label: "7 days", from: addDays(today, -6), to: today },
    { label: "30 days", from: addDays(today, -29), to: today },
    { label: "90 days", from: addDays(today, -89), to: today },
    { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
  ];
  const presets = all.filter((p) => quick.includes(p.label));
  const matching = (r: { from: string; to: string }) => presets.findIndex((p) => p.from === r.from && p.to === r.to);

  const [range, setRange] = useState({ from, to });
  const [custom, setCustom] = useState(matching({ from, to }) < 0);
  // The fields always show the dates the data uses: on new dates from the server, and when this
  // page is shown again (cacheComponents keeps left pages alive, with what was typed in them).
  useResetWhenShown(() => {
    setRange({ from, to });
    setCustom(matching({ from, to }) < 0);
  }, `${from}|${to}`);
  const root = useRef<HTMLDivElement>(null);
  const fromInput = useRef<HTMLInputElement>(null);

  const pick = (next: { from: string; to: string }) => {
    setCustom(false);
    setRange(next);
    // Let the inputs take the new values, then apply the form they belong to.
    requestAnimationFrame(() => root.current?.closest("form")?.requestSubmit());
  };
  const pickCustom = () => {
    setCustom(true);
    requestAnimationFrame(() => fromInput.current?.focus());
  };
  // Only the first matching quick range is marked (on the 1st, "This month" is the same as "Today").
  const active = custom ? -1 : matching(range);

  return (
    <div ref={root} className="flex flex-wrap items-end gap-2">
      <div role="group" aria-label="Dates" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {presets.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={active === i} onClick={() => pick(p)} className={tab(active === i)}>
            {p.label}
          </button>
        ))}
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
          max={isRealDate(range.to) ? range.to : today}
          min={isRealDate(range.to) ? addDays(range.to, -max) : undefined}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className={field}
        />
      </label>
      <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", !custom && "hidden")}>
        To
        <input
          type="date"
          name="to"
          value={range.to}
          min={isRealDate(range.from) ? range.from : undefined}
          max={today}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className={field}
        />
      </label>
    </div>
  );
}

/**
 * Just the From and To fields, always shown (for pages that list one day by default). Like
 * DateRange, they go back to the page's dates whenever the page is shown again.
 */
export function FromToFields({ from, to, today }: { from: string; to: string; today: string }) {
  const [range, setRange] = useState({ from, to });
  useResetWhenShown(() => setRange({ from, to }), `${from}|${to}`);
  const label = "flex flex-col gap-1 text-xs font-medium text-muted-foreground";
  return (
    <>
      <label className={label}>
        From
        <input type="date" name="from" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={field} />
      </label>
      <label className={label}>
        To
        <input type="date" name="to" value={range.to} min={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={field} />
      </label>
    </>
  );
}
