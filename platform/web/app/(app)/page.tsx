/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { getSessionUser } from "@/common/auth/session";
import { studentScope } from "@/common/auth/student-access";
import { usingSampleData } from "@/common/data/roster";
import { formatDate, greetingIst, todayIst } from "@/common/lib/dates";
import { parseRange } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { EvaluationDashboard } from "@/modules/analytics/components/evaluation-dashboard";
import { DashboardSkeleton } from "@/modules/analytics/components/dashboard-skeleton";

export const metadata = { title: "Home" };

/** Home is the Instructor Evaluation dashboard (with attendance): the cohort for admins, your own students otherwise. */
async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const user = await getSessionUser();
  if (usingSampleData()) {
    return <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">The dashboard needs the database.</p>;
  }
  const today = todayIst();
  return (
    <EvaluationDashboard
      range={parseRange(await searchParams, today, 1)}
      today={today}
      scope={studentScope(user)}
      heading={false}
      eyebrow={`${greetingIst()}, ${user.name.split(" ")[0]} · ${formatDate(today)}`}
    />
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<DashboardSkeleton label="Loading home" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
