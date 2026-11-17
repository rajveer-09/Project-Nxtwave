/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { BarList } from "@/common/components/bar-list";
import { StatusPill } from "@/common/components/chips";
import { GlobalFilters, GlobalFiltersFallback } from "@/modules/shell/global-filters";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { StatCard } from "@/common/components/stat-card";
import { AtRiskTable } from "@/modules/home/at-risk-table";
import { isAdminRole } from "@/common/auth/roles";
import { getSessionUser } from "@/common/auth/session";
import { getHomeData, type HomeData } from "@/modules/home/data";
import { Skeleton } from "@/common/ui/skeleton";
import { cn } from "@/common/lib/utils";

export const metadata = { title: "Home" };

async function Greeting() {
  const user = await getSessionUser();
  return <>Good morning, {user.name.split(" ")[0]}</>;
}

async function AdminTodo({ items }: { items: HomeData["todo"] }) {
  const user = await getSessionUser();
  if (!isAdminRole(user.role)) return null;
  return (
    <SectionCard title="Admin to-do">
      {items.length ? null : <p className="text-[13px] text-muted-foreground">Nothing waiting.</p>}
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2.5 rounded-lg px-3 text-[13px] font-semibold",
                item.urgent ? "bg-warning-soft text-warning" : "bg-background text-foreground hover:bg-muted",
              )}
            >
              {item.label}
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

async function HomeEyebrow() {
  const data = await getHomeData();
  return <>{data.dateLabel}</>;
}

async function SampleBadge() {
  const data = await getHomeData();
  return data.sample ? <StatusPill>Sample data</StatusPill> : null;
}

async function HomeContent() {
  const data = await getHomeData();
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {data.kpis.map((kpi) => (
          <StatCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <SectionCard
          className="flex-[2_1_600px]"
          bodyClassName="px-0 pb-2"
          title="Students who need attention"
          description={`Flags combine attendance, interactions and contests · ${data.atRiskTotal} students`}
          action={
            <Link href="/students?flag=any" className="text-[13px] font-semibold text-primary hover:text-accent-strong">
              View all at-risk →
            </Link>
          }
        >
          <AtRiskTable rows={data.atRisk} />
        </SectionCard>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Suspense fallback={null}>
            <AdminTodo items={data.todo} />
          </Suspense>
          <SectionCard title="DSA level distribution" action={<span className="text-xs text-muted-foreground">{data.students} students</span>}>
            <BarList items={data.levels} labelWidth="2.25rem" />
          </SectionCard>
          <SectionCard
            title="Attendance by hall · 30 days"
            action={
              <Link href="/attendance" className="text-[13px] font-semibold text-primary hover:text-accent-strong">
                Mark today
              </Link>
            }
          >
            <BarList items={data.halls} max={100} labelWidth="3.75rem" />
            <div className="mt-3.5 flex gap-3.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" />
                75% and above
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-warning-strong" />
                Below 75%
              </span>
            </div>
          </SectionCard>
          {data.contest ? (
            <SectionCard title={data.contest.name} description={data.contest.date} action={<StatusPill tone="accent">{data.contest.state}</StatusPill>}>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  [String(data.contest.tookPart), "took part"],
                  [data.contest.medianSolved, "median solved"],
                  [data.contest.bestGlobalRank, "best global rank"],
                ].map(([value, label]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-heading text-[22px] font-semibold tabular">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/contests" className="mt-3 flex min-h-11 items-center text-[13px] font-semibold text-primary hover:text-accent-strong">
                Open contest results →
              </Link>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading home">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-wrap gap-5">
        <Skeleton className="h-[420px] flex-[2_1_600px] rounded-xl" />
        <Skeleton className="h-[420px] flex-[1_1_320px] rounded-xl" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <Suspense fallback="Today">
            <HomeEyebrow />
          </Suspense>
        }
        title={
          <Suspense fallback="Good morning">
            <Greeting />
          </Suspense>
        }
        actions={
          <>
            <Suspense fallback={<GlobalFiltersFallback />}>
              <GlobalFilters />
            </Suspense>
            <Suspense fallback={null}>
              <SampleBadge />
            </Suspense>
          </>
        }
      />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </>
  );
}
