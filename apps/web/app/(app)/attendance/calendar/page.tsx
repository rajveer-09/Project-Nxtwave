/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView } from "@/modules/attendance/components/calendar-view";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { todayIst } from "@/common/lib/dates";

export const metadata = { title: "Attendance calendar" };

async function Content() {
  await connection();
  await requireAccess("/attendance");
  return <CalendarView today={todayIst()} />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
