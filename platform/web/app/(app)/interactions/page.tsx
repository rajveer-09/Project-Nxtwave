/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { InteractionForm, type FormStudent } from "@nxtone/interactions-ui/components/interaction-form";
import { RecentLogs } from "@nxtone/interactions-ui/components/recent-logs";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { inScope, studentScope } from "@/common/auth/student-access";
import { addDays, todayIst } from "@/common/lib/dates";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { canLogInteractions } from "@nxtone/interactions-ui/lib/permissions";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { getRoster, usingSampleData } from "@/common/data/roster";
import { latestTestTotals } from "@/modules/tests/data";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import type { SearchParamsRecord } from "@/common/lib/url";
import { questionBank as loadQuestionBank } from "@nxtone/interactions-ui/curriculum/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { SectionCard } from "@/common/components/section-card";
import { LiveForm } from "@/common/components/live-form";
import { DateRange } from "@/common/components/date-range";
import { DailyBars } from "@/common/components/charts";
import { eachDay, parseRange, shortDay } from "@/common/lib/range";

export const metadata = { title: "Interactions" };

function lastLabel(days: number | null) {
  if (days === null) return null;
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

async function InteractionsContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  // "Today" and the logs are request-time data: render per request, never from a prerender.
  await connection();
  const user = await requireAccess("/interactions");
  const params = await searchParams;
  // Instructors and senior instructors log for their own students; coaches read their coached students' logs.
  const scope = studentScope(user) ?? (user.role === "senior_instructor" ? { instructor: user.name } : undefined);
  const logging = canLogInteractions(user);

  const roster = await getRoster();
  const sample = usingSampleData();
  const myStudents = roster.filter((s) => inScope(scope, s)).sort((a, b) => a.name.localeCompare(b.name));
  const latestTests = sample ? null : await latestTestTotals(myStudents.map((s) => s.niatId));
  const [all, questionBank, structure] = await Promise.all([
    listInteractions(scope?.coach !== undefined ? { niatIds: myStudents.map((s) => s.niatId) } : { instructor: scope?.instructor }),
    loadQuestionBank(),
    getStructure(),
  ]);
  const overdue = myStudents.filter((s) => s.lastInteractionDays === null || s.lastInteractionDays >= RISK_THRESHOLDS.interactionGapDays);
  const today = todayIst();
  const weekAgo = addDays(today, -7);
  const thisWeek = all.filter((it) => it.date > weekAgo).length;

  // Activity for the chosen dates (and, for admins, one person who took the interactions)
  const range = parseRange(params, today, 30);
  const takenBy = typeof params.by === "string" && params.by ? params.by : null;
  const people = [...new Set(all.map((it) => it.takenBy))].sort();
  const inRange = all.filter((it) => it.date >= range.from && it.date <= range.to && (!takenBy || it.takenBy === takenBy));
  const perDay = new Map<string, number>();
  for (const it of inRange) perDay.set(it.date, (perDay.get(it.date) ?? 0) + 1);
  const daily = eachDay(range).map((day) => ({ day, label: shortDay(day), value: perDay.get(day) ?? 0 }));
  const busiest = daily.reduce((best, d) => (d.value > (best?.value ?? 0) ? d : best), null as (typeof daily)[number] | null);
  const reached = new Set(inRange.map((it) => it.niatId)).size;
  const activity = [
    ["Interactions", inRange.length.toLocaleString("en-IN")],
    ["Per day", (inRange.length / range.days).toFixed(1)],
    ["Busiest day", busiest && busiest.value ? `${busiest.label} · ${busiest.value}` : "—"],
    ["Students reached", reached.toLocaleString("en-IN")],
  ];

  const formStudents: FormStudent[] = myStudents.map((s) => ({
    niatId: s.niatId,
    name: s.name,
    group: `${s.college} · ${s.section} · ${s.hall}`,
    level: s.level,
    topic: s.topic,
    subtopic: s.subtopic,
    attendance30d: s.attendance30d,
    lastInteractionDays: s.lastInteractionDays,
    lastInteractionLabel: lastLabel(s.lastInteractionDays),
    contestAbsentStreak: s.risk.contestAbsentStreak,
    latestTest: latestTests ? (latestTests.get(s.niatId) ?? null) : (buildStudentDetail(s).tests.list.at(-1)?.total ?? null),
  }));
  const instructors = [...new Set(roster.map((s) => s.instructor).filter((name) => name !== "Unassigned"))].sort();
  const student = typeof params.student === "string" ? params.student.toUpperCase() : undefined;

  return (
    <>
      <PageHeader
        eyebrow={logging ? `Interactions · my students (${myStudents.length})` : "Interactions · all students"}
        title={logging ? "Log an interaction" : "Interactions"}
        actions={
          <div className="flex flex-wrap gap-2 text-[13px]">
            <StatusPill tone={overdue.length ? "warning" : "accent"}>
              {overdue.length} {logging ? "of my students" : "students"} overdue ({RISK_THRESHOLDS.interactionGapDays}d+)
            </StatusPill>
            <StatusPill tone="accent">{thisWeek} logged this week</StatusPill>
            {sample ? <StatusPill>Sample data</StatusPill> : null}
          </div>
        }
      />

      {logging && overdue.length ? (
        <nav aria-label="Overdue students" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-[13px]">
          <span className="font-semibold text-warning">Overdue:</span>
          {overdue.map((s) => (
            <Link
              key={s.niatId}
              href={`/interactions?student=${s.niatId}`}
              className="flex min-h-8 items-center rounded-full bg-card px-3 font-semibold text-foreground hover:bg-muted"
            >
              {s.name} · {s.lastInteractionDays === null ? "never" : `${s.lastInteractionDays}d`}
            </Link>
          ))}
        </nav>
      ) : null}

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
            {student ? <input type="hidden" name="student" value={student} /> : null}
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

      <div className="flex flex-wrap items-start gap-5">
        {logging ? (
          <InteractionForm
            key={student ?? "none"}
            students={formStudents}
            instructors={instructors}
            userId={user.id}
            userName={user.name}
            initialStudent={student}
            today={today}
            questionBank={questionBank}
            structure={structure}
          />
        ) : null}
        <RecentLogs rows={inRange.slice(0, logging ? 12 : 40)} total={inRange.length} exportHref="/api/logs/interactions/export" />
      </div>
    </>
  );
}

export default function InteractionsPage({ searchParams }: PageProps<"/interactions">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading interactions">
          <Skeleton className="h-16 w-96" />
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[640px] flex-[1_1_520px] rounded-xl" />
            <Skeleton className="h-[480px] flex-[1_1_460px] rounded-xl" />
          </div>
        </div>
      }
    >
      <InteractionsContent searchParams={searchParams} />
    </Suspense>
  );
}
