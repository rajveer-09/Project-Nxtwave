/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { AnalyticsView } from "@nxtone/attendance-ui/components/analytics-view";

export const metadata = { title: "Attendance analytics" };

async function Content() {
  await connection();
  // Owners and success coaches (nav.ts); the service checks it again.
  await requireAccess("/admin/attendance-analytics");
  return <AnalyticsView />;
}

export default function AttendanceAnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
