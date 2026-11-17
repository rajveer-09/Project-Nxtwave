/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { BarList } from "@/common/components/bar-list";
import { DailyBars, TrendLine } from "@/common/components/charts";
import { DateRange } from "@/common/components/date-range";
import { LiveForm } from "@/common/components/live-form";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { StatCard, type Trend } from "@/common/components/stat-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { usingSampleData } from "@/common/data/roster";
import { todayIst } from "@/common/lib/dates";
import { eachDay, parseRange, shortDay } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { getAnalytics, type Headline } from "@/modules/analytics/data";
import { RISK_THRESHOLDS } from "@/common/domain/risk";

export const metadata = { title: "Analytics" };

const OUTCOME_LABEL: Record<string, string> = { Cleared: "Cleared", "In Progress": "In progress", "Need to Revisit": "Needs revisit" };
const fmt = (n: number) => n.toLocaleString("en-IN");

/** "+3.2 pts vs previous 30 days" style comparison; higher is better for every headline here. */
function compare(now: number | null, before: number | null, unit: "pts" | "count", days: number): { delta: string; trend: Trend } {
  if (now === null || before === null) return { delta: "", trend: "neutral" };
  const diff = Math.round((now - before) * 10) / 10;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const amount = unit === "pts" ? `${Math.abs(diff)} pts` : fmt(Math.abs(diff));
  return { delta: `${sign}${amount} vs previous ${days} days`, trend: diff > 0 ? "good" : diff < 0 ? "bad" : "neutral" };
}

function Headlines({ now, before, days, roster }: { now: Headline; before: Headline; days: number; roster: number }) {
  const cards = [
    { module: "Attendance", label: "Average attendance", value: now.attendancePct === null ? "—" : `${now.attendancePct}%`, sub: "Present ÷ marked, counted days", ...compare(now.attendancePct, before.attendancePct, "pts", days) },
    { module: "Interactions", label: "Interactions logged", value: fmt(now.interactions), sub: `${(now.interactions / days).toFixed(1)} a day`, ...compare(now.interactions, before.interactions, "count", days) },
    { module: "Interactions", label: "Students reached", value: fmt(now.studentsReached), sub: `of ${fmt(roster)} on the roster`, ...compare(now.studentsReached, before.studentsReached, "count", days) },
    { module: "DSA progress", label: "Level-ups", value: fmt(now.levelUps), sub: "Students moved up a level", ...compare(now.levelUps, before.levelUps, "count", days) },
    { module: "Contests", label: "Contest participation", value: now.contestParticipation === null ? "—" : `${now.contestParticipation}%`, sub: "Took part ÷ students with a handle", ...compare(now.contestParticipation, before.contestParticipation, "pts", days) },
  ];
  return (
    <section aria-label="Headline numbers" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </section>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  await requireAccess("/analytics");
  const today = todayIst();
  const range = parseRange(await searchParams, today, 30);

  const header = (
    <PageHeader
      eyebrow="Admin panel"
      title="Analytics"
      description="How the cohort is doing across attendance, interactions, DSA progress and contests, for any dates."
    />
  );
  const filters = (
    <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Choose dates">
      <DateRange from={range.from} to={range.to} today={today} />
    </LiveForm>
  );
  if (usingSampleData()) {
    return (
      <>
        {header}
        <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">Analytics needs the database.</p>
      </>
    );
  }

  const a = await getAnalytics(range.from, range.to);
  const days = eachDay(range);
  const attendanceMap = new Map(a.attendanceByDay.map((d) => [d.day, d.pct]));
  const interactionMap = new Map(a.interactionsByDay.map((d) => [d.day, d.n]));
  const attendanceSeries = days.map((day) => ({ day, label: shortDay(day), value: attendanceMap.get(day) ?? null }));
  const interactionSeries = days.map((day) => ({ day, label: shortDay(day), value: interactionMap.get(day) ?? 0 }));
  const outcomesTotal = a.outcomes.reduce((n, o) => n + o.n, 0) || 1;

  return (
    <>
      {header}
      {filters}
      <Headlines now={a.headline} before={a.previous} days={range.days} roster={a.rosterSize} />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Attendance by day" description={`Present ÷ marked · ${RISK_THRESHOLDS.attendancePct}% line · days off are gaps`}>
          <TrendLine data={attendanceSeries} valueLabel="Attendance" target={RISK_THRESHOLDS.attendancePct} />
          <p className="sr-only">{attendanceSeries.filter((d) => d.value !== null).map((d) => `${d.label}: ${d.value}%`).join(", ")}</p>
        </SectionCard>
        <SectionCard title="Interactions per day" description={`${fmt(a.headline.interactions)} logged · ${shortDay(range.from)} – ${shortDay(range.to)}`}>
          <DailyBars data={interactionSeries} valueLabel="Interactions" />
          <p className="sr-only">{interactionSeries.map((d) => `${d.label}: ${d.value}`).join(", ")}</p>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Most interactions" description="Top 10 who took them">
          {a.topInstructors.length ? (
            <BarList items={a.topInstructors.map((t) => ({ label: t.name, value: t.n, display: fmt(t.n) }))} labelWidth="9rem" />
          ) : (
            <p className="text-sm text-muted-foreground">No interactions in these dates.</p>
          )}
        </SectionCard>
        <SectionCard title="Interaction outcomes" description="Share of interactions">
          {a.outcomes.length ? (
            <BarList
              items={a.outcomes.map((o) => ({
                label: OUTCOME_LABEL[o.status] ?? o.status,
                value: o.n,
                display: `${fmt(o.n)} · ${Math.round((o.n * 100) / outcomesTotal)}%`,
                warn: o.status === "Need to Revisit",
              }))}
              labelWidth="7.5rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No interactions in these dates.</p>
          )}
        </SectionCard>
        <SectionCard title="Level-ups" description={`Moved up to each level${a.levelDowns ? ` · ${a.levelDowns} moved down` : ""}`}>
          {a.levelUpsTo.length ? (
            <BarList items={a.levelUpsTo.map((l) => ({ label: `To L${l.level}`, value: l.n, display: fmt(l.n) }))} labelWidth="4rem" />
          ) : (
            <p className="text-sm text-muted-foreground">No level changes in these dates.</p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Attendance by hall" description={`Below ${RISK_THRESHOLDS.attendancePct}% in orange`}>
          {a.attendanceByHall.length ? (
            <BarList
              items={a.attendanceByHall.map((h) => ({ label: h.hall, value: h.pct, display: `${h.pct}% · ${h.students}`, warn: h.pct < RISK_THRESHOLDS.attendancePct }))}
              max={100}
              labelWidth="4.5rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing marked in these dates.</p>
          )}
        </SectionCard>
        <SectionCard title="Contest participation" description="Took part ÷ students with a handle, per contest">
          {a.contests.length ? (
            <BarList
              items={a.contests.map((c) => {
                const p = c.handles ? Math.round((c.tookPart * 100) / c.handles) : 0;
                return { label: `${shortDay(c.day)} · ${c.title.replace(/^(Weekly|Biweekly) Contest /, "$1 ")}`, value: p, display: `${p}% · ${c.tookPart}` };
              })}
              max={100}
              labelWidth="10rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No contests scanned in these dates.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading analytics">
          <Skeleton className="h-16 w-96" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      }
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
