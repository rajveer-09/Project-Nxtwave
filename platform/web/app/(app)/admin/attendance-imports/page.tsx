/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { ImportsView } from "@nxtone/attendance-ui/components/imports-view";

export const metadata = { title: "Attendance imports" };

async function Content() {
  await connection();
  // Owners and admins (nav.ts), as in the attendance dashboard; the service checks it again.
  await requireAccess("/admin/attendance-imports");
  return <ImportsView />;
}

export default function AttendanceImportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
