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

export const metadata = { title: "DSA attendance data" };

async function Content() {
  await connection();
  // Owners and admins (nav.ts); the service checks it again. Imports and export share this page.
  await requireAccess("/admin/attendance-data");
  return <ImportsView />;
}

export default function AttendanceDataPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Content />
    </Suspense>
  );
}
