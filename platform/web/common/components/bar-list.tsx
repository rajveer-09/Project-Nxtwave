/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

export type BarListItem = {
  label: string;
  value: number;
  display?: string;
  /** Marks the bar as below target (orange). */
  warn?: boolean;
};

/**
 * Horizontal bars with a label and value, e.g. level distribution or attendance by hall.
 * The value text is always shown, so colour is never the only signal.
 */
export function BarList({
  items,
  max,
  labelWidth = "3.5rem",
  valueWidth = "3rem",
  className,
}: {
  items: BarListItem[];
  max?: number;
  labelWidth?: string;
  valueWidth?: string;
  className?: string;
}) {
  const top = max ?? Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="grid items-center gap-2.5 text-[13px]"
          style={{ gridTemplateColumns: `${labelWidth} minmax(0, 1fr) ${valueWidth}` }}
        >
          <span className="font-medium text-muted-foreground">{item.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span
              className={cn("block h-full rounded-full", item.warn ? "bg-warning-strong" : "bg-primary")}
              style={{ width: `${Math.max(2, Math.round((item.value / top) * 100))}%` }}
            />
          </span>
          <span className={cn("text-right font-semibold tabular", item.warn && "text-warning")}>
            {item.display ?? item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
