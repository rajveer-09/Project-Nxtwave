/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { IntentLink } from "@/common/components/intent-link";
import { FlagLegend, StudentFlags } from "@/common/components/student-flags";
import { DataTable } from "@/common/components/data-table";
import type { AtRiskStudent } from "@/modules/home/sample-data";
import { cn } from "@/common/lib/utils";

const columns: ColumnDef<AtRiskStudent>[] = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <IntentLink href={`/students/${row.original.niatId}`} className="font-semibold text-foreground hover:text-primary">
          {row.original.name}
        </IntentLink>
        <span className="text-xs text-muted-foreground tabular">{row.original.niatId}</span>
      </div>
    ),
  },
  {
    id: "group",
    header: "Group",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-sidebar-foreground">
        {row.original.college} · {row.original.section} · {row.original.hall}
      </span>
    ),
  },
  {
    accessorKey: "attendance30d",
    header: "Attendance · 30d",
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      if (value === null) return <span className="text-muted-foreground">—</span>;
      const low = value < 75;
      return (
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className={cn("block h-full", low ? "bg-warning-strong" : "bg-primary")} style={{ width: `${value}%` }} />
          </span>
          <span className={cn("font-semibold tabular", low && "text-warning")}>{value}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "lastInteractionDays",
    header: "Last interaction",
    cell: ({ getValue }) => {
      const days = getValue<number | null>();
      return <span className="text-sidebar-foreground">{days === null ? "Never" : days === 0 ? "Today" : `${days} days ago`}</span>;
    },
  },
  {
    accessorKey: "contestsAttended",
    header: "Contests attended",
    cell: ({ getValue }) => <span className="text-sidebar-foreground tabular">{getValue<number>()}</span>,
  },
  {
    id: "flags",
    header: () => (
      <span className="inline-flex items-center gap-1">
        Why flagged <FlagLegend />
      </span>
    ),
    enableSorting: false,
    // The whole cell is the flags' hover/click target (StudentFlags fills it; padding matches the last column's).
    meta: { cellClassName: "relative" },
    cell: ({ row }) => <StudentFlags flags={row.original.flags} name={row.original.name} className="pr-5 pl-3" />,
  },
];

export function AtRiskTable({ rows }: { rows: AtRiskStudent[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      caption="Students who need attention"
      emptyTitle="No students need attention"
      emptyDescription="Nobody matches the at-risk rules for the current filters."
    />
  );
}
