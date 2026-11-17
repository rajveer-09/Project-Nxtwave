/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { Construction } from "lucide-react";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";

/** Placeholder for routes whose phase has not started yet (UI_IMPLEMENTATION_PLAN.md §4). */
export function ComingSoon({
  title,
  phase,
  summary,
  prototypeScreen,
}: {
  title: string;
  phase: string;
  summary: string;
  prototypeScreen?: string;
}) {
  return (
    <>
      <PageHeader eyebrow={`Planned in ${phase}`} title={title} description={summary} />
      <EmptyState
        icon={Construction}
        title="This screen is not built yet"
        description={
          prototypeScreen
            ? `It follows prototype screen ${prototypeScreen}. The menu entry and access rules are already in place.`
            : "The menu entry and access rules are already in place."
        }
      />
    </>
  );
}
