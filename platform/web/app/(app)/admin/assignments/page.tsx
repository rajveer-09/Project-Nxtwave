/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { LiveForm } from "@/common/components/live-form";
import { Dropdown } from "@/common/components/dropdown";
import { asOptions } from "@/common/lib/options";
import { searchMatcher } from "@/common/lib/search";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { getRoster, usingSampleData } from "@/common/data/roster";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { staffOptions } from "@/modules/admin/assignments-data";
import { AssignSelect, ImportPanel } from "@/modules/admin/components/assignment-controls";
import { AssignmentHistoryButton } from "@/modules/admin/components/assignment-history";

export const metadata = { title: "Assign POC" };

const PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/admin/assignments");
  const params = await searchParams;
  const match = searchMatcher(one(params.q));
  const instructor = one(params.instructor);
  const hall = one(params.hall);
  const page = Math.max(1, Number(one(params.page)) || 1);

  const [roster, options] = await Promise.all([getRoster(), staffOptions()]);
  const filtered = roster.filter(
    (s) =>
      match(s.name, s.niatId) &&
      (!instructor || s.instructor === instructor) &&
      (!hall || s.hall === hall),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((Math.min(page, pageCount) - 1) * PAGE, Math.min(page, pageCount) * PAGE);
  const instructors = [...new Set(roster.map((s) => s.instructor))].sort();
  const halls = [...new Set(roster.map((s) => s.hall))].sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 999) - Number(b.match(/\d+/)?.[0] ?? 999));
  const unassigned = roster.filter((s) => s.instructor === "Unassigned").length;
  const sample = usingSampleData();

  return (
    <>
      <PageHeader
        eyebrow={user.role === "senior_instructor" ? "Senior SDI panel" : "Admin panel"}
        title="Assign POC"
        description="Who teaches and who coaches each student. Every change keeps history and goes to the change log with your name."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={unassigned ? "warning" : "accent"}>{unassigned} without an instructor</StatusPill>
            {sample ? <StatusPill>Sample data · changes need the database</StatusPill> : null}
          </div>
        }
      />
      <SectionCard title="Upload from Excel" description="Move many students at once. You'll see exactly what changes before anything is saved.">
        <ImportPanel />
      </SectionCard>
      <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter students">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input name="q" defaultValue={one(params.q)} placeholder="Name or NIAT ID" className={`${field} w-60`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Instructor
          <Dropdown
            name="instructor"
            defaultValue={instructor ?? ""}
            options={[{ value: "", label: "Anyone" }, ...asOptions(instructors)]}
            searchPlaceholder="Search instructors…"
            className="w-52"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Hall
          <Dropdown
            name="hall"
            defaultValue={hall ?? ""}
            options={[{ value: "", label: "Any" }, ...asOptions(halls)]}
            searchPlaceholder="Search halls…"
            className="w-36"
          />
        </label>
        <Link href="/admin/assignments" className="flex h-10 items-center px-2 text-sm font-semibold text-primary hover:text-accent-strong">
          Clear
        </Link>
      </LiveForm>
      <SectionCard title={`${filtered.length} students`} description={`Page ${Math.min(page, pageCount)} of ${pageCount}`} bodyClassName="px-0 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-[13px]">
            <caption className="sr-only">Students and their instructor and coach</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">Student</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Class</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Instructor</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Success coach</th>
                <th scope="col" className="border-b border-border px-5 py-2.5 text-right font-semibold">
                  <span className="sr-only">History</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.niatId}>
                  <td className="border-b border-muted px-5 py-2">
                    <Link href={`/students/${s.niatId}`} className="font-semibold hover:text-primary">
                      {s.name}
                    </Link>
                    <div className="text-xs text-muted-foreground tabular">{s.niatId}</div>
                  </td>
                  <td className="border-b border-muted px-3 py-2 text-sidebar-foreground">
                    {s.college} · {s.section} · {s.hall}
                  </td>
                  <td className="border-b border-muted px-3 py-2">
                    <AssignSelect niatId={s.niatId} student={s.name} kind="instructor" current={s.instructor} options={options.instructor} />
                  </td>
                  <td className="border-b border-muted px-3 py-2">
                    <AssignSelect niatId={s.niatId} student={s.name} kind="coach" current={s.coach} options={options.coach} />
                  </td>
                  <td className="border-b border-muted px-5 py-2 text-right">
                    <AssignmentHistoryButton niatId={s.niatId} student={s.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <nav aria-label="Pages" className="flex justify-between">
        {page > 1 ? (
          <Link href={withParams("/admin/assignments", params, { page: page - 1 > 1 ? page - 1 : null })} className="text-sm font-semibold text-primary">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {page < pageCount ? (
          <Link href={withParams("/admin/assignments", params, { page: page + 1 })} className="text-sm font-semibold text-primary">
            Next →
          </Link>
        ) : null}
      </nav>
    </>
  );
}

export default function AssignmentsPage({ searchParams }: PageProps<"/admin/assignments">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
