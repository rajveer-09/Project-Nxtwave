/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

export type Trend = "good" | "bad" | "neutral";

const TREND_CLASS: Record<Trend, string> = {
  good: "text-accent-strong",
  bad: "text-warning",
  neutral: "text-muted-foreground",
};

export function StatCard({
  module,
  label,
  value,
  sub,
  delta,
  trend = "neutral",
  className,
}: {
  module?: string;
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  trend?: Trend;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-xl border border-border bg-card px-5 py-4", className)}>
      {module ? (
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{module}</span>
      ) : null}
      <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
      <span className="font-heading text-[34px] leading-tight font-semibold tracking-tight tabular">{value}</span>
      {sub ? <span className="text-[13px] text-muted-foreground">{sub}</span> : null}
      {delta ? <span className={cn("text-xs font-semibold", TREND_CLASS[trend])}>{delta}</span> : null}
    </div>
  );
}
