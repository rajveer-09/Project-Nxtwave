/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { IntentLink } from "@/common/components/intent-link";
import type { SortKey, StudentQuery } from "@/modules/students/data";
import type { RosterStudent } from "@/common/sample-data/roster";
import { FLAG_LABEL, flagsWithDetail } from "@/common/domain/risk";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";
import type { SessionUser } from "@/common/auth/roles";
import { logHrefFor } from "@nxtone/interactions-ui/lib/permissions";
import { StudentRowActions } from "./row-actions";

function SortHeader({
  label,
  sortKey,
  query,
  params,
  basePath,
}: {
  label: string;
  sortKey: SortKey;
  basePath: string;
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
        href={withParams(basePath, params, { sort: sortKey, dir: nextDir })}
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

export function StudentsTable({
  rows,
  query,
  params,
  viewer,
  basePath = "/students",
  hideInstructor = false,
}: {
  rows: RosterStudent[];
  query: StudentQuery;
  params: SearchParamsRecord;
  /** Instructors only see their own students, so the Instructor column is left out for them. */
  viewer: SessionUser;
  /** The list's page, for the sort links. */
  basePath?: string;
  /** Leave out the Instructor column (a senior instructor's own students). */
  hideInstructor?: boolean;
}) {
  const showInstructor = viewer.role !== "instructor" && !hideInstructor;
  return (
    // @container: the row buttons show their text only when this area is at least 78rem wide
    // (row-actions.tsx); below that they're icon-only, so the table needs less width.
    <div className="@container overflow-x-auto">
      <table className="w-full min-w-[1040px] border-collapse text-[13px] @[78rem]:min-w-[1240px]">
        <caption className="sr-only">Students</caption>
        <thead>
          <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <SortHeader label="Student" sortKey="name" query={query} params={params} basePath={basePath} />
            <Th>College · Section</Th>
            <Th>Hall</Th>
            {showInstructor ? <Th>Instructor</Th> : null}
            <SortHeader label={"Attendance · 30 days"} sortKey="attendance" query={query} params={params} basePath={basePath} />
            <SortHeader label="Level" sortKey="level" query={query} params={params} basePath={basePath} />
            <SortHeader label="LeetCode" sortKey="rating" query={query} params={params} basePath={basePath} />
            <SortHeader label="Last interaction" sortKey="interaction" query={query} params={params} basePath={basePath} />
            <Th>Flags</Th>
            <th scope="col" className="border-b border-border py-2.5 pr-5 pl-3 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const low = s.attendance30d !== null && s.attendance30d < 75;
            return (
              <tr key={s.niatId} className="hover:bg-surface-subtle">
                <td className="border-b border-muted py-2.5 pr-3 pl-5">
                  <IntentLink href={`/students/${s.niatId}`} className="font-semibold text-foreground hover:text-primary">
                    {s.name}
                  </IntentLink>
                  <div className="text-xs text-muted-foreground tabular">{s.niatId}</div>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">
                  {s.college} · {s.section}
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">{s.hall}</td>
                {showInstructor ? <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">{s.instructor}</td> : null}
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
                {/* Each flag as red text; hovering one shows this student's own numbers behind it. */}
                <td className="border-b border-muted px-3 py-2.5">
                  {s.flags.length ? (
                    <ul className="flex flex-col items-start gap-1">
                      {flagsWithDetail(s.flags, s.risk).map((f) => (
                        <li key={f.key} title={f.detail} className="text-xs font-semibold whitespace-nowrap text-destructive">
                          {FLAG_LABEL[f.key]}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">On track</span>
                  )}
                </td>
                <td className="border-b border-muted py-2 pr-5 pl-3">
                  <StudentRowActions niatId={s.niatId} name={s.name} logHref={logHrefFor(viewer, s)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
