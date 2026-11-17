/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import type { FormatField, ResultValue } from "@/modules/tests/types";
import { cn } from "@/common/lib/utils";

const box =
  "rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

/** Renders one format field as an input. Used by results entry and the format preview. */
export function FieldInput({
  field,
  value,
  onChange,
  disabled,
  compact,
  label,
}: {
  field: FormatField;
  value: ResultValue | undefined;
  onChange: (value: ResultValue) => void;
  disabled?: boolean;
  /** Table cell: number box only. */
  compact?: boolean;
  /** Accessible name when the visible label is elsewhere (table cells). */
  label?: string;
}) {
  const aria = label ?? field.label;
  switch (field.type) {
    case "marks":
    case "number":
      return (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={field.type === "marks" ? field.max : undefined}
          step="0.5"
          aria-label={aria}
          disabled={disabled}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={cn(box, compact ? "h-9 w-16 px-2 tabular" : "h-10 w-28")}
        />
      );
    case "rating":
      return (
        <div role="group" aria-label={aria} className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={value === n}
              disabled={disabled}
              onClick={() => onChange(value === n ? null : n)}
              className={cn("min-h-9 min-w-9 rounded-lg border text-sm font-semibold", value === n ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}
            >
              {n}
            </button>
          ))}
        </div>
      );
    case "yesno":
      return (
        <div role="group" aria-label={aria} className="flex gap-1.5">
          {[
            [true, "Yes"],
            [false, "No"],
          ].map(([v, text]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={value === v}
              disabled={disabled}
              onClick={() => onChange(value === v ? null : (v as boolean))}
              className={cn("min-h-9 rounded-lg border px-3.5 text-sm font-semibold", value === v ? "border-foreground bg-foreground text-background" : "border-input bg-card")}
            >
              {text as string}
            </button>
          ))}
        </div>
      );
    case "single":
      return (
        <select aria-label={aria} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} className={cn(box, "h-10 w-full")}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multi": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-label={aria} className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((o) => {
            const on = picked.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => onChange(on ? picked.filter((x) => x !== o) : [...picked, o])}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-semibold",
                  on ? "border-warning-border bg-warning-soft text-warning" : "border-input bg-card text-sidebar-foreground",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "short":
      return <input aria-label={aria} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={cn(box, "h-10 w-full")} />;
    case "long":
      return (
        <textarea
          aria-label={aria}
          rows={3}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(box, "w-full py-2")}
        />
      );
  }
}
