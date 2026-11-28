/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

export type PillTone = "accent" | "warning" | "danger" | "neutral";

const PILL_TONE: Record<PillTone, string> = {
  accent: "bg-accent text-accent-foreground",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive dark:bg-destructive/20",
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
