/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { Download, FileUp } from "lucide-react";
import { cn } from "@/common/lib/utils";
import type { PeriodKind } from "@nxtone/attendance-ui/types";
import { downloadSample, type SAMPLE_SHEETS } from "@nxtone/attendance-ui/sample-sheets";

/** Shared pieces of the import and export screens, in the Student Hub theme (light and dark). */

export const TONE = {
  neutral: "bg-muted text-muted-foreground ring-border",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
  blue: "bg-accent text-accent-strong ring-accent-border",
  red: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800",
  amber: "bg-warning-soft text-warning ring-warning-border",
  violet: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800",
  sky: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800",
} as const;
export type Tone = keyof typeof TONE;

export const ACTION: Record<"new" | "update" | "unchanged" | "error", { label: string; tone: Tone }> = {
  new: { label: "New", tone: "green" },
  update: { label: "Update", tone: "blue" },
  unchanged: { label: "Unchanged", tone: "neutral" },
  error: { label: "Error", tone: "red" },
};

/** Display names and colours for the two attendance categories. */
export const CATEGORY: Record<PeriodKind, { label: string; short: string; tone: Tone }> = {
  INTERNSHIP: { label: "Internship Period", short: "Internship", tone: "violet" },
  REGISTRATION_PENDING: { label: "Term 5 Registration Pending", short: "Registration pending", tone: "amber" },
};

export const control =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** "2026-11-16" → "Mon, 16 Nov" */
export const formatDay = (ymd: string) => dayFmt.format(new Date(`${ymd}T00:00:00Z`));

export function Badge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", TONE[tone], className)}>{children}</span>;
}

export function Count({ label, n, tone }: { label: string; n: number; tone: Tone }) {
  return (
    <Badge tone={tone} className="py-1">
      {label} <span className="tabular">{n.toLocaleString("en-IN")}</span>
    </Badge>
  );
}

export function Notice({ tone, children, className }: { tone: "green" | "red" | "amber" | "neutral" | "violet"; children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-inset", TONE[tone], className)}>{children}</div>;
}

/** A themed file picker: the native input stays (keyboard and screen readers), styled as a button row. */
export function FilePicker({
  inputRef,
  file,
  label,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  label: string;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-input bg-surface-subtle px-3.5 py-2.5 transition-colors hover:border-primary/60 focus-within:ring-3 focus-within:ring-ring/50">
      <FileUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{file ? file.name : "Choose a .xlsx or .csv file"}</span>
        <span className="block text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Max 10 MB. Nothing is saved until you confirm."}</span>
      </span>
      <input ref={inputRef} type="file" accept=".xlsx,.csv" aria-label={label} className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function SampleLink({ kind }: { kind: keyof typeof SAMPLE_SHEETS }) {
  return (
    <button type="button" onClick={() => downloadSample(kind)} className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
      <Download className="size-3.5" aria-hidden /> Download sample CSV
    </button>
  );
}

/** Errors and warnings listed under a preview row. */
export function RowNotes({ errors = [], warnings = [], skipped = [], blank = 0 }: { errors?: string[]; warnings?: string[]; skipped?: string[]; blank?: number }) {
  return (
    <>
      {errors.map((e) => (
        <div key={e} className="text-red-700 dark:text-red-300">
          {e}
        </div>
      ))}
      {skipped.map((e) => (
        <div key={e} className="text-warning">
          Skipped: {e}
        </div>
      ))}
      {warnings.map((w) => (
        <div key={w} className="text-warning">
          {w}
        </div>
      ))}
      {blank > 0 ? <div className="text-muted-foreground">{blank} blank cell(s): no change</div> : null}
    </>
  );
}

export const th = "px-3 py-2.5 font-medium";
export const td = "px-3 py-2";
export const tableWrap = "overflow-x-auto rounded-xl border border-border";
export const theadRow = "bg-surface-subtle text-left text-xs text-muted-foreground";
