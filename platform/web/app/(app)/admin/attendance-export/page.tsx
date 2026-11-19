/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { ExportView } from "@nxtone/attendance-ui/components/export-view";

export const metadata = { title: "Attendance export" };

async function Content() {
  await connection();
  // Owners and admins (nav.ts), as in the attendance dashboard; the service checks it again.
  await requireAccess("/admin/attendance-export");
  return <ExportView />;
}

export default function AttendanceExportPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
