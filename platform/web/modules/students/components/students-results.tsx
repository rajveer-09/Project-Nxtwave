/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { StudentsFilters, StudentsFiltersFallback } from "@/modules/students/components/students-filters";
import { StudentsTable } from "@/modules/students/components/students-table";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { studentScope, type StudentScope } from "@/common/auth/student-access";
import { listStudents, parseStudentQuery, type FlagFilter } from "@/modules/students/data";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";

const CHIPS: { key: FlagFilter | "all"; label: string }[] = [
  { key: "all", label: "All students" },
  { key: "any", label: "Needs attention" },
  { key: "attendance", label: "Attendance < 75%" },
  { key: "interaction", label: "No interaction in 14+ days" },
  { key: "tests", label: "Below pass in tests" },
  { key: "contests", label: "Missed contests" },
  { key: "level", label: "Stuck on level" },
];

/**
 * The student list with its filters, quick filters and paging.
 * - /students:    everyone the viewer may see (instructors and coaches: their own students)
 * - /my-students: senior instructors' own students (they see everyone on /students)
 */
export async function StudentsResults({ searchParams, mine = false }: { searchParams: Promise<SearchParamsRecord>; mine?: boolean }) {
  const basePath = mine ? "/my-students" : "/students";
  const user = await requireAccess(basePath);
  const params = await searchParams;
  const scope: StudentScope | undefined = mine ? { instructor: user.name } : studentScope(user);
  const query = { ...parseStudentQuery(params), ...(scope ?? {}) };
  const result = await listStudents(query);
  if (scope?.instructor) result.options.instructors = [scope.instructor];
  const activeChip = query.flag ?? "all";

  if (mine && result.flagCounts.all === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <EmptyState
          title="No students are assigned to you yet"
          description="Students an admin assigns to you on Assignments appear here. Every student is under Students."
        />
      </section>
    );
  }

  return (
    <>
      <Suspense fallback={<StudentsFiltersFallback />}>
        <StudentsFilters options={result.options} hide={scope?.instructor ? ["college", "section", "hall", "instructor"] : []} />
      </Suspense>

      <nav aria-label="Quick filters" className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const active = activeChip === chip.key;
          return (
            <Link
              key={chip.key}
              href={withParams(basePath, params, { flag: chip.key === "all" ? null : chip.key })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold",
                active ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted",
              )}
            >
              {chip.label}
              <span className="font-medium opacity-80 tabular">{result.flagCounts[chip.key]}</span>
            </Link>
          );
        })}
      </nav>

      <section aria-label="Student list" className="overflow-hidden rounded-xl border border-border bg-card">
        {result.rows.length ? (
          <StudentsTable rows={result.rows} query={query} params={params} viewer={user} basePath={basePath} hideInstructor={mine} />
        ) : (
          <div className="p-5">
            <EmptyState title="No students match these filters" description="Clear a filter or search for a different name or NIAT ID." />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[13px] text-muted-foreground">
          <span>
            {result.total} student{result.total === 1 ? "" : "s"}
            {result.pageCount > 1 ? ` · page ${result.page} of ${result.pageCount}` : ""}
          </span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link
                href={withParams(basePath, params, { page: result.page - 1 })}
                className="flex min-h-9 items-center rounded-lg border border-input bg-card px-3 font-medium text-foreground hover:bg-muted"
              >
                Previous
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={withParams(basePath, params, { page: result.page + 1 })}
                className="flex min-h-9 items-center rounded-lg border border-input bg-card px-3 font-medium text-foreground hover:bg-muted"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

export function StudentsResultsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading students">
      <Skeleton className="h-[78px] rounded-xl" />
      <Skeleton className="h-10 w-2/3 rounded-full" />
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}
