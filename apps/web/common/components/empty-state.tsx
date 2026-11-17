/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-card px-6 py-10 text-center">
      <Icon aria-hidden="true" className="size-6 text-muted-foreground" strokeWidth={1.8} />
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
