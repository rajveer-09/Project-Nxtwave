/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { redirect } from "next/navigation";

/** Export now lives on the Attendance data page; keep old links working. */
export default function AttendanceExportPage() {
  redirect("/admin/attendance-data?tab=export");
}
