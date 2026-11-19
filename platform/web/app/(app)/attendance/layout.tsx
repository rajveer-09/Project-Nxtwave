/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { authMode } from "@/common/auth/config";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { AttendanceTabs, AttendanceTabsFallback } from "@nxtone/attendance-ui/components/attendance-tabs";

/**
 * Without the Go service the pages read the database (read-only), or the in-memory sample without one.
 * Read when the page is opened, not at build time (a build without settings would say "Sample data").
 */
async function SourcePill() {
  await connection();
  if (process.env.ATTENDANCE_API_ORIGIN && process.env.ATTENDANCE_JWT_SECRET) return null;
  if (authMode() === "database") return <StatusPill>Live data · read-only: marking needs the attendance service</StatusPill>;
  return <StatusPill>Sample data · attendance service not connected</StatusPill>;
}

export default function AttendanceLayout({ children }: LayoutProps<"/attendance">) {
  return (
    <>
      <PageHeader eyebrow="Attendance" title="Attendance" actions={
          <Suspense fallback={null}>
            <SourcePill />
          </Suspense>
        } />
      <Suspense fallback={<AttendanceTabsFallback />}>
        <AttendanceTabs />
      </Suspense>
      {children}
    </>
  );
}
