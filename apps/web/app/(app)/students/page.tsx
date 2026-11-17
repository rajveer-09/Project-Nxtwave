/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { StudentsFilters, StudentsFiltersFallback } from "@/modules/students/components/students-filters";
import { StudentsTable } from "@/modules/students/components/students-table";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { studentScope } from "@/common/auth/student-access";
import { listStudents, parseStudentQuery, type FlagFilter } from "@/modules/students/data";
import { usingSampleData } from "@/common/data/roster";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";

export const metadata = { title: "Students" };

const CHIPS: { key: FlagFilter | "all"; label: string }[] = [
  { key: "all", label: "All students" },
  { key: "any", label: "Needs attention" },
  { key: "attendance", label: "Attendance < 75%" },
  { key: "interaction", label: "No interaction 14d+" },
  { key: "tests", label: "Below pass in tests" },
  { key: "contests", label: "Missed contests" },
  { key: "level", label: "Stuck on level" },
];

async function StudentsResults({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/students");
  const params = await searchParams;
  const scope = studentScope(user);
  const query = { ...parseStudentQuery(params), ...(scope ?? {}) };
  const result = await listStudents(query);
  if (scope?.instructor) result.options.instructors = [scope.instructor];
  const activeChip = query.flag ?? "all";

  return (
    <>
      <Suspense fallback={<StudentsFiltersFallback />}>
        <StudentsFilters options={result.options} />
      </Suspense>

      <nav aria-label="Quick filters" className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const active = activeChip === chip.key;
          return (
            <Link
              key={chip.key}
              href={withParams("/students", params, { flag: chip.key === "all" ? null : chip.key })}
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
          <StudentsTable rows={result.rows} query={query} params={params} />
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
                href={withParams("/students", params, { page: result.page - 1 })}
                className="flex min-h-9 items-center rounded-lg border border-input bg-card px-3 font-medium text-foreground hover:bg-muted"
              >
                Previous
              </Link>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={withParams("/students", params, { page: result.page + 1 })}
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

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading students">
      <Skeleton className="h-[78px] rounded-xl" />
      <Skeleton className="h-10 w-2/3 rounded-full" />
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}

export default function StudentsPage({ searchParams }: PageProps<"/students">) {
  return (
    <>
      <PageHeader
        eyebrow="One roster for every module · keyed by NIAT ID"
        title="Students"
        actions={usingSampleData() ? <StatusPill>Sample data · no database connected</StatusPill> : null}
      />
      <Suspense fallback={<ResultsSkeleton />}>
        <StudentsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}
