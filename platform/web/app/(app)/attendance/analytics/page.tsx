/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { Construction } from "lucide-react";
import { EmptyState } from "@/common/components/empty-state";

export const metadata = { title: "Attendance analytics" };

export default function AttendanceAnalyticsPage() {
  return (
    <EmptyState
      icon={Construction}
      title="Analytics isn't moved over yet"
      description="Attendance by college, hall and day, with comparisons to the previous period and an XLSX export (GET /api/admin/analytics). Owners only, as today. The screens come in the next attendance pass."
    />
  );
}
