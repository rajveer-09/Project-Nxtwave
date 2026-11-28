/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { authMode } from "@/common/auth/config";
import { getSessionUser } from "@/common/auth/session";
import { canAccess } from "@/common/lib/nav";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { AttendanceTabs, AttendanceTabsFallback } from "@nxtone/attendance-ui/components/attendance-tabs";

/**
 * Without the Go service the pages read the database and save hall marks only, or use the in-memory
 * sample without one.
 * Read when the page is opened, not at build time (a build without settings would say "Sample data").
 */
async function SourcePill() {
  await connection();
  if (process.env.ATTENDANCE_API_ORIGIN && process.env.ATTENDANCE_JWT_SECRET) return null;
  if (authMode() === "database") return <StatusPill>Live data · marking only: other changes need the attendance service</StatusPill>;
  return <StatusPill>Sample data · attendance service not connected</StatusPill>;
}

/** The tabs, with Students for the people who may open it (the same rule as the page guard). */
async function Tabs() {
  await connection();
  const user = await getSessionUser();
  return <AttendanceTabs showStudents={canAccess(user.role, "/attendance/students")} />;
}

export default function AttendanceLayout({ children }: LayoutProps<"/attendance">) {
  return (
    <>
      <PageHeader eyebrow="DSA attendance" title="DSA attendance" actions={
          <Suspense fallback={null}>
            <SourcePill />
          </Suspense>
        } />
      <Suspense fallback={<AttendanceTabsFallback />}>
        <Tabs />
      </Suspense>
      {children}
    </>
  );
}
