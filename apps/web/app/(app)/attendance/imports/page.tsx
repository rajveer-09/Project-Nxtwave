/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Construction } from "lucide-react";
import { EmptyState } from "@/common/components/empty-state";

export const metadata = { title: "Attendance imports" };

export default function AttendanceImportsPage() {
  return (
    <EmptyState
      icon={Construction}
      title="Imports isn't moved over yet"
      description="Upload students, attendance or calendar sheets (CSV or XLSX), preview every row, then commit. The attendance service already supports this (POST /api/admin/imports/{students|attendance|calendar}); the screens come in the next attendance pass."
    />
  );
}
