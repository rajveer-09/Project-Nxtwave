/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { FlagChip } from "@/common/components/chips";
import type { SortKey, StudentQuery } from "@/modules/students/data";
import type { RosterStudent } from "@/common/sample-data/roster";
import { FLAG_LABEL } from "@/common/domain/risk";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";

function SortHeader({
  label,
  sortKey,
  query,
  params,
}: {
  label: string;
  sortKey: SortKey;
  query: StudentQuery;
  params: SearchParamsRecord;
}) {
  const active = (query.sort ?? "name") === sortKey;
  const dir = query.dir ?? (sortKey === "name" || sortKey === "attendance" ? "asc" : "desc");
  const nextDir = active ? (dir === "asc" ? "desc" : "asc") : sortKey === "name" || sortKey === "attendance" ? "asc" : "desc";
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className="border-b border-border px-3 py-2.5 font-semibold first:pl-5"
    >
      <Link
        href={withParams("/students", params, { sort: sortKey, dir: nextDir })}
        scroll={false}
        className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-foreground"
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3.5", !active && "opacity-50")} />
      </Link>
    </th>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold last:pr-5">
      {children}
    </th>
  );
}

export function StudentsTable({ rows, query, params }: { rows: RosterStudent[]; query: StudentQuery; params: SearchParamsRecord }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-[13px]">
        <caption className="sr-only">Students</caption>
        <thead>
          <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <SortHeader label="Student" sortKey="name" query={query} params={params} />
            <Th>College · Section</Th>
            <Th>Hall</Th>
            <Th>Instructor</Th>
            <SortHeader label="Attendance · 30d" sortKey="attendance" query={query} params={params} />
            <SortHeader label="Level" sortKey="level" query={query} params={params} />
            <SortHeader label="LeetCode" sortKey="rating" query={query} params={params} />
            <SortHeader label="Last interaction" sortKey="interaction" query={query} params={params} />
            <Th>Flags</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const low = s.attendance30d !== null && s.attendance30d < 75;
            return (
              <tr key={s.niatId} className="hover:bg-surface-subtle">
                <td className="border-b border-muted py-2.5 pr-3 pl-5">
                  <Link href={`/students/${s.niatId}`} className="font-semibold text-foreground hover:text-primary">
                    {s.name}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular">{s.niatId}</div>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">
                  {s.college} · {s.section}
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">{s.hall}</td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">{s.instructor}</td>
                <td className="border-b border-muted px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <span className={cn("block h-full", low ? "bg-warning-strong" : "bg-primary")} style={{ width: `${s.attendance30d ?? 0}%` }} />
                    </span>
                    <span className={cn("font-semibold tabular", low && "text-warning")}>{s.attendance30d === null ? "—" : `${s.attendance30d}%`}</span>
                  </div>
                </td>
                <td className="border-b border-muted px-3 py-2.5">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">L{s.level}</span>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground tabular">
                  {s.lcRating ? s.lcRating.toLocaleString("en-IN") : <span className="text-muted-foreground">No handle</span>}
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">
                  {s.lastInteractionDays === null ? "Never" : s.lastInteractionDays === 0 ? "Today" : s.lastInteractionDays === 1 ? "Yesterday" : `${s.lastInteractionDays} days ago`}
                </td>
                <td className="border-b border-muted py-2.5 pr-5 pl-3">
                  {s.flags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {s.flags.map((flag) => (
                        <FlagChip key={flag}>{FLAG_LABEL[flag]}</FlagChip>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">On track</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
