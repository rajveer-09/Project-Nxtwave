/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { requireAccess } from "@/common/auth/guard";
import { studentScope } from "@/common/auth/student-access";
import { usingSampleData } from "@/common/data/roster";
import { todayIst } from "@/common/lib/dates";
import { parseRange } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { EvaluationDashboard } from "@/modules/analytics/components/evaluation-dashboard";
import { DashboardSkeleton } from "@/modules/analytics/components/dashboard-skeleton";

export const metadata = { title: "Analytics" };

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const user = await requireAccess("/analytics");
  if (usingSampleData()) {
    return <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">Analytics needs the database.</p>;
  }
  const today = todayIst();
  return <EvaluationDashboard range={parseRange(await searchParams, today, 30)} today={today} scope={studentScope(user)} eyebrow="Admin panel · Analytics" />;
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <Suspense fallback={<DashboardSkeleton label="Loading analytics" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
