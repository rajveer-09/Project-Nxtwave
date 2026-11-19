/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { redirect } from "next/navigation";

/** Imports now live on the Attendance data page; keep old links working. */
export default function AttendanceImportsPage() {
  redirect("/admin/attendance-data");
}
