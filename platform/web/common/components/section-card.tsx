/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

/** White bordered panel with an optional heading row. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card", className)}>
      {title || action ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3.5">
          <div className="flex flex-col">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {description ? <span className="text-[13px] text-muted-foreground">{description}</span> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={cn(title || action ? "px-5 pb-5" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
