/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { RecentLogs } from "@nxtone/interactions-ui/components/recent-logs";
import { OverdueBanner, OverduePill, OverdueReminder } from "@nxtone/interactions-ui/components/overdue-banner";
import { OVERDUE_COOKIE, overdueStartsOpen, parseOverduePref } from "@nxtone/interactions-ui/lib/overdue-cookie";
import { MyStudents } from "@nxtone/interactions-ui/components/my-students";
import { isOverdue, myStudentsList, scopedStudents } from "@nxtone/interactions-ui/my-students-data";
import { usingSampleData } from "@/common/data/roster";
import { roomsByInteraction } from "@nxtone/interactions-ui/room/data";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { addDays, todayIst } from "@/common/lib/dates";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { canLogInteractions } from "@nxtone/interactions-ui/lib/permissions";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import type { SearchParamsRecord } from "@/common/lib/url";
import { SectionCard } from "@/common/components/section-card";
import { LiveForm } from "@/common/components/live-form";
import { DateRange } from "@/common/components/date-range";
import { DailyBars } from "@/common/components/charts";
import { eachDay, parseRange, shortDay } from "@/common/lib/range";

export const metadata = { title: "Interactions" };

async function InteractionsContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  // "Today" and the logs are request-time data: render per request, never from a prerender.
  await connection();
  const user = await requireAccess("/interactions");
  const params = await searchParams;
  // Old links opened the form here; logging has its own page now.
  if (typeof params.student === "string" && params.student) redirect(`/log-interaction?niat=${encodeURIComponent(params.student.toUpperCase())}`);
  // Instructors and senior instructors log for their own students; coaches read their coached students' logs.
  const logging = canLogInteractions(user);
  const sample = usingSampleData();
  const { scope, students: myStudents } = await scopedStudents(user);
  const [all, mine] = await Promise.all([
    listInteractions(scope?.coach !== undefined ? { niatIds: myStudents.map((s) => s.niatId) } : { instructor: scope?.instructor }),
    myStudentsList(user),
  ]);
  const overdue = myStudents.filter(isOverdue);
  // Whether the Overdue banner starts open (its toggle is remembered in a cookie).
  const overduePref = parseOverduePref((await cookies()).get(OVERDUE_COOKIE)?.value);
  const today = todayIst();
  const weekAgo = addDays(today, -7);
  const thisWeek = all.filter((it) => it.date > weekAgo).length;

  // Activity for the chosen dates (and, for admins, one person who took the interactions)
  const range = parseRange(params, today, 30);
  const takenBy = typeof params.by === "string" && params.by ? params.by : null;
  const people = [...new Set(all.map((it) => it.takenBy))].sort();
  const inRange = all.filter((it) => it.date >= range.from && it.date <= range.to && (!takenBy || it.takenBy === takenBy));
  const recent = inRange.slice(0, 40);
  const codeRooms = await roomsByInteraction(recent.map((it) => it.id));
  const perDay = new Map<string, number>();
  for (const it of inRange) perDay.set(it.date, (perDay.get(it.date) ?? 0) + 1);
  const daily = eachDay(range).map((day) => ({ day, label: shortDay(day), value: perDay.get(day) ?? 0 }));
  const busiest = daily.reduce((best, d) => (d.value > (best?.value ?? 0) ? d : best), null as (typeof daily)[number] | null);
  const reached = new Set(inRange.map((it) => it.niatId)).size;
  const activity = [
    ["Interactions", inRange.length.toLocaleString("en-IN")],
    ["Busiest day", busiest && busiest.value ? `${busiest.label} · ${busiest.value}` : "—"],
    ["Students reached", reached.toLocaleString("en-IN")],
  ];


  const overdueLabel = `${overdue.length} ${logging ? "of my students" : "students"} overdue (${RISK_THRESHOLDS.interactionGapDays}d+)`;
  // Instructors with overdue students: the pill is a button that shows/hides the list below it.
  const overdueReminder = logging && overdue.length > 0;

  return (
    <OverdueReminder
      count={overdue.length}
      initialOpen={overdueStartsOpen(overduePref, overdue.length)}
      seen={overduePref.open ? null : overduePref.seen}
    >
      <PageHeader
        eyebrow={logging ? `Interactions · my students (${myStudents.length})` : "Interactions · all students"}
        title="Interactions"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {overdueReminder ? (
              <OverduePill>{overdueLabel}</OverduePill>
            ) : (
              <StatusPill tone={overdue.length ? "warning" : "accent"}>{overdueLabel}</StatusPill>
            )}
            <StatusPill tone="accent">{thisWeek} logged this week</StatusPill>
            {sample ? <StatusPill>Sample data</StatusPill> : null}
            {logging ? (
              <Link href="/log-interaction" className="ml-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Log interaction
              </Link>
            ) : null}
          </div>
        }
      />

      {overdueReminder ? (
        <OverdueBanner students={overdue.map((s) => ({ niatId: s.niatId, name: s.name, days: s.lastInteractionDays }))} />
      ) : null}

      {mine ? <MyStudents students={mine} overdueDays={RISK_THRESHOLDS.interactionGapDays} /> : null}

      {!logging ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
          Interactions are logged by the assigned instructor. As {user.role === "owner" ? "an Owner" : "an Admin"} you can read and export every log.
        </p>
      ) : null}

      <SectionCard
        title="Interactions"
        description={`${shortDay(range.from)} – ${shortDay(range.to)}${takenBy ? ` · taken by ${takenBy}` : ""}`}
      >
        <div className="flex flex-col gap-4">
          <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter interactions">
            <DateRange from={range.from} to={range.to} today={today} />
            {!logging || user.role === "senior_instructor" ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Taken by
                <select name="by" defaultValue={takenBy ?? ""} className="h-10 rounded-lg border border-input bg-card px-2.5 pr-8 text-sm text-foreground">
                  <option value="">Everyone</option>
                  {people.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </LiveForm>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {activity.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border px-3.5 py-2.5">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="font-heading text-xl font-semibold tabular">{value}</dd>
              </div>
            ))}
          </dl>
          <DailyBars data={daily} valueLabel="Interactions" />
          <p className="sr-only">{daily.map((d) => `${d.label}: ${d.value}`).join(", ")}</p>
        </div>
      </SectionCard>

      <RecentLogs rows={recent} total={inRange.length} exportHref="/api/logs/interactions/export" codeRooms={codeRooms} />
    </OverdueReminder>
  );
}

export default function InteractionsPage({ searchParams }: PageProps<"/interactions">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading interactions">
          <Skeleton className="h-16 w-96" />
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[640px] flex-[1_1_440px] rounded-xl" />
            <Skeleton className="h-[480px] flex-[1.5_1_560px] rounded-xl" />
          </div>
        </div>
      }
    >
      <InteractionsContent searchParams={searchParams} />
    </Suspense>
  );
}
