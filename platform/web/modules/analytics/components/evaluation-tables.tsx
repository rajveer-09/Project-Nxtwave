/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/common/components/data-table";
import { STANDING_LABEL, type Standing } from "@/common/domain/standing";
import { SearchField } from "@/common/components/search-field";

const num = (value: number, tone?: "good" | "warn") => (
  <span className={value === 0 ? "text-muted-foreground/60 tabular" : tone === "good" ? "font-semibold text-accent-strong tabular" : tone === "warn" ? "font-semibold text-warning tabular" : "tabular"}>
    {value}
  </span>
);

// ---------------------------------------------------------------- instructors

export type InstructorRow = { name: string; today: number; last3: number; last7: number; inRange: number; cleared: number; revisits: number };

const instructorColumns: ColumnDef<InstructorRow, unknown>[] = [
  { accessorKey: "name", header: "Instructor", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: "today", header: "Today", cell: ({ row }) => num(row.original.today) },
  { accessorKey: "last3", header: "Last 3 days", cell: ({ row }) => num(row.original.last3) },
  { accessorKey: "last7", header: "Last 7 days", cell: ({ row }) => num(row.original.last7) },
  { accessorKey: "inRange", header: "In these dates", cell: ({ row }) => num(row.original.inRange) },
  { accessorKey: "cleared", header: "Cleared (all time)", cell: ({ row }) => num(row.original.cleared, "good") },
  { accessorKey: "revisits", header: "Revisits (all time)", cell: ({ row }) => num(row.original.revisits, "warn") },
];

/** Interactions each instructor took: today, last 3 and 7 days, the chosen dates, and all-time outcomes. */
export function InstructorMetrics({ rows }: { rows: InstructorRow[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows;
  return (
    <div className="flex flex-col gap-3">
      <div className="px-5">
        <SearchField label="Search instructor" value={query} onChange={setQuery} className="max-w-72" />
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        <DataTable columns={instructorColumns} data={shown} minWidth={720} caption="Interactions per instructor" emptyTitle="No instructor matches" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- students

export type StudentRow = {
  niatId: string;
  name: string;
  college: string;
  instructor: string;
  level: number;
  standing: Standing;
  interactions: number;
  cleared: number;
  revisits: number;
  last: string | null;
};

const studentColumns: ColumnDef<StudentRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Student",
    cell: ({ row }) => (
      <Link href={`/students/${row.original.niatId}`} className="flex flex-col font-medium hover:text-primary">
        {row.original.name}
        <span className="text-xs font-normal text-muted-foreground tabular">{row.original.niatId}</span>
      </Link>
    ),
  },
  { accessorKey: "instructor", header: "Instructor" },
  { accessorKey: "level", header: "Level", cell: ({ row }) => `L${row.original.level}` },
  { accessorKey: "standing", header: "Standing", cell: ({ row }) => STANDING_LABEL[row.original.standing] },
  { accessorKey: "interactions", header: "Interactions", cell: ({ row }) => num(row.original.interactions) },
  { accessorKey: "cleared", header: "Cleared", cell: ({ row }) => num(row.original.cleared, "good") },
  { accessorKey: "revisits", header: "Revisits", cell: ({ row }) => num(row.original.revisits, "warn") },
  { accessorKey: "last", header: "Last interaction", cell: ({ row }) => <span className="tabular">{row.original.last ?? "—"}</span> },
];

/** Every student's interactions (all time), most first; the name opens their page and history. */
export function StudentInteractions({ rows }: { rows: StudentRow[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.niatId.toLowerCase().includes(needle)) : rows;
  return (
    <div className="flex flex-col gap-3">
      <div className="px-5">
        <SearchField label="Search name or NIAT ID" value={query} onChange={setQuery} className="max-w-72" />
      </div>
      <div className="max-h-[32rem] overflow-y-auto">
        <DataTable columns={studentColumns} data={shown} minWidth={900} caption="Interactions per student" emptyTitle="No student matches" />
      </div>
    </div>
  );
}
