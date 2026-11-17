/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { AttendanceTabs, AttendanceTabsFallback } from "@/modules/attendance/components/attendance-tabs";

const connected = !!(process.env.ATTENDANCE_API_ORIGIN && process.env.ATTENDANCE_JWT_SECRET);

export default function AttendanceLayout({ children }: LayoutProps<"/attendance">) {
  return (
    <>
      <PageHeader
        eyebrow="Attendance"
        title="Attendance"
        actions={connected ? null : <StatusPill>Sample attendance service · Go API not connected</StatusPill>}
      />
      <Suspense fallback={<AttendanceTabsFallback />}>
        <AttendanceTabs />
      </Suspense>
      {children}
    </>
  );
}
