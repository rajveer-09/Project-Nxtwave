/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { ComingSoon } from "@/common/components/coming-soon";
import { requireAccess } from "@/common/auth/guard";

export const metadata = { title: "Analytics" };

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAccess("/analytics");
  return children;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <Gate>
        <AnalyticsSoon />
      </Gate>
    </Suspense>
  );
}

function AnalyticsSoon() {
  return (
    <ComingSoon
      title="Analytics"
      phase="UI-8"
      summary="Cohort heatmap and trends across all modules."
      prototypeScreen="Home option D"
    />
  );
}
