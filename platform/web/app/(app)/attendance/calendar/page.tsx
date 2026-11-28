/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarPage as CalendarScreen } from "@nxtone/attendance-ui/components/calendar/calendar-page";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";

export const metadata = { title: "DSA attendance calendar" };

async function Content() {
  await connection();
  const user = await requireAccess("/attendance");
  // Everyone sees the month view; Owners and admins edit (the attendance service checks it again).
  const canEdit = user.role === "owner" || user.role === "admin";
  return <CalendarScreen canEdit={canEdit} isOwner={user.role === "owner"} />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
