/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { ComingSoon } from "@/common/components/coming-soon";
import { requireAccess } from "@/common/auth/guard";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireAccess("/analytics");
  return (
    <ComingSoon
      title="Analytics"
      phase="UI-8"
      summary="Cohort heatmap and trends across all modules."
      prototypeScreen="Home option D"
    />
  );
}
