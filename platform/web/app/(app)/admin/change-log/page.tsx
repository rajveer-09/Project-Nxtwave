/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { LiveForm } from "@/common/components/live-form";
import { Dropdown } from "@/common/components/dropdown";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { ENTITIES, ENTITY_LABEL, listChanges, SOURCE_LABEL, SOURCES, type ChangeFilter } from "@/modules/admin/change-log-data";
import { ChangeTable } from "@/modules/admin/components/change-table";

export const metadata = { title: "Change log" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function parse(params: SearchParamsRecord): ChangeFilter {
  const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const page = Number(one(params.page));
  return {
    q: one(params.q)?.slice(0, 100),
    source: (SOURCES as readonly string[]).includes(one(params.source) ?? "") ? one(params.source) : undefined,
    entity: (ENTITIES as readonly string[]).includes(one(params.entity) ?? "") ? one(params.entity) : undefined,
    from: date(one(params.from)),
    to: date(one(params.to)),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/admin/change-log");
  const params = await searchParams;
  const filter = parse(params);
  const { entries, page, more } = await listChanges(user, filter);
  const query = Object.fromEntries(Object.entries(filter).filter(([k, v]) => v !== undefined && k !== "page").map(([k, v]) => [k, String(v)]));

  return (
    <>
      <PageHeader
        eyebrow="Admin panel"
        title="Change log"
        description="Every change to who teaches or coaches whom, to a student's class (college, section, hall, status) and to staff and roles: who made it, when, and from where (NxtOne, an Excel import, a backend service or a direct database edit)."
        actions={
          <a href={`/api/admin/change-log/export?${new URLSearchParams(query)}`} className="flex min-h-10 items-center rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted">
            Export CSV
          </a>
        }
      />
      <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter the change log">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <input name="q" defaultValue={filter.q} placeholder="Student, NIAT ID, staff or name" className={`${field} w-64`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Type
          <Dropdown
            name="entity"
            defaultValue={filter.entity ?? ""}
            options={[{ value: "", label: "All" }, ...ENTITIES.map((e) => ({ value: e, label: ENTITY_LABEL[e] }))]}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From
          <Dropdown
            name="source"
            defaultValue={filter.source ?? ""}
            options={[{ value: "", label: "Anywhere" }, ...SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))]}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          On or after
          <input type="date" name="from" defaultValue={filter.from} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          On or before
          <input type="date" name="to" defaultValue={filter.to} className={field} />
        </label>
        <Link href="/admin/change-log" className="flex h-10 items-center px-2 text-sm font-semibold text-primary hover:text-accent-strong">
          Clear
        </Link>
      </LiveForm>
      <SectionCard title={`Page ${page}`} bodyClassName="px-0 pb-2">
        <ChangeTable entries={entries} />
      </SectionCard>
      <nav aria-label="Pages" className="flex justify-between">
        {page > 1 ? (
          <Link href={withParams("/admin/change-log", query, { page: page - 1 > 1 ? page - 1 : null })} className="text-sm font-semibold text-primary">
            ← Newer
          </Link>
        ) : (
          <span />
        )}
        {more ? (
          <Link href={withParams("/admin/change-log", query, { page: page + 1 })} className="text-sm font-semibold text-primary">
            Older →
          </Link>
        ) : null}
      </nav>
    </>
  );
}

export default function ChangeLogPage({ searchParams }: PageProps<"/admin/change-log">) {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
