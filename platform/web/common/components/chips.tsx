/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

/** Orange risk flag, e.g. "Attendance < 75%". Orange (not red) is the single risk colour. */
export function FlagChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type PillTone = "accent" | "warning" | "neutral";

const PILL_TONE: Record<PillTone, string> = {
  accent: "bg-accent text-accent-foreground",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-muted text-sidebar-foreground",
};

/** Small status label, e.g. "Final", "Draft · review", "Cleared". */
export function StatusPill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", PILL_TONE[tone])}>
      {children}
    </span>
  );
}
