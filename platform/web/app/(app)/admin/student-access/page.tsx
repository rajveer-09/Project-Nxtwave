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
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { listAccess, MAX_ISSUE, type AccountStatus } from "@/modules/admin/student-access-data";
import { BulkIssue, StudentAccessTable } from "@/modules/admin/components/student-access-controls";

export const metadata = { title: "Student access" };

const PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const STATUS: Record<AccountStatus, { label: string; tone: "accent" | "warning" | "neutral" }> = {
  none: { label: "No sign-in", tone: "neutral" },
  waiting: { label: "Not signed in yet", tone: "warning" },
  active: { label: "Active", tone: "accent" },
  disabled: { label: "Switched off", tone: "neutral" },
};

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/admin/student-access");
  const params = await searchParams;
  const rows = await listAccess(user);
  if (!rows) {
    return <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">Student sign-in needs the database.</p>;
  }
  const match = searchMatcher(one(params.q));
  const hall = one(params.hall);
  const status = one(params.status) as AccountStatus | undefined;
  const page = Math.max(1, Number(one(params.page)) || 1);
  const filtered = rows.filter((r) => match(r.name, r.niatId, r.section) && (!hall || r.hall === hall) && (!status || r.status === status));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((Math.min(page, pageCount) - 1) * PAGE, Math.min(page, pageCount) * PAGE);
  const withoutSignIn = filtered.filter((r) => r.status === "none").map((r) => ({ niatId: r.niatId, name: r.name }));
  const counts = Object.fromEntries((Object.keys(STATUS) as AccountStatus[]).map((s) => [s, rows.filter((r) => r.status === s).length])) as Record<AccountStatus, number>;
  const halls = [...new Set(rows.map((r) => r.hall))].sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 999) - Number(b.match(/\d+/)?.[0] ?? 999));

  return (
    <>
      <PageHeader
        eyebrow="Admin panel"
        title="Student access"
        description="Students sign in to NxtOne with their NIAT ID and see only their own progress. Issue a temporary password here; they choose their own the first time they sign in. Every change is in the change log."
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="accent">{counts.active} active</StatusPill>
            <StatusPill tone="warning">{counts.waiting} not signed in yet</StatusPill>
            <StatusPill>{counts.none} without sign-in</StatusPill>
          </div>
        }
      />
      <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter students">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input name="q" defaultValue={one(params.q)} placeholder="Name, NIAT ID or section" className={`${field} w-60`} />
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
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sign-in
          <Dropdown
            name="status"
            defaultValue={status ?? ""}
            options={[{ value: "", label: "Any" }, ...(Object.keys(STATUS) as AccountStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))]}
            className="w-44"
          />
        </label>
        <Link href="/admin/student-access" className="flex h-10 items-center px-2 text-sm font-semibold text-primary hover:text-accent-strong">
          Clear
        </Link>
        <span className="grow" />
        <BulkIssue
          students={withoutSignIn.slice(0, MAX_ISSUE)}
          label={withoutSignIn.length ? `Give sign-in to ${Math.min(withoutSignIn.length, MAX_ISSUE)} without it` : "Everyone here has sign-in"}
        />
      </LiveForm>
      <SectionCard title={`${filtered.length} students`} description={`Page ${Math.min(page, pageCount)} of ${pageCount}. Bulk issue works on the filtered list, up to ${MAX_ISSUE} at a time.`} bodyClassName="px-0 pb-2">
        <StudentAccessTable rows={shown} />
      </SectionCard>
      <nav aria-label="Pages" className="flex justify-between">
        {page > 1 ? (
          <Link href={withParams("/admin/student-access", params, { page: page - 1 > 1 ? page - 1 : null })} className="text-sm font-semibold text-primary">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {page < pageCount ? (
          <Link href={withParams("/admin/student-access", params, { page: page + 1 })} className="text-sm font-semibold text-primary">
            Next →
          </Link>
        ) : null}
      </nav>
    </>
  );
}

export default function StudentAccessPage({ searchParams }: PageProps<"/admin/student-access">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
