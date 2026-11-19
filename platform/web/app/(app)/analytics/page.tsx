/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { Download } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { BarList } from "@/common/components/bar-list";
import { DailyBars, TrendLine } from "@/common/components/charts";
import { DateRange } from "@/common/components/date-range";
import { LiveForm } from "@/common/components/live-form";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { StatCard, type Trend } from "@/common/components/stat-card";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { getRoster, usingSampleData } from "@/common/data/roster";
import { todayIst } from "@/common/lib/dates";
import { eachDay, parseRange, shortDay } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { getAnalytics, type Headline } from "@/modules/analytics/data";
import { getConversions, getEvaluation, type OutcomeCounts } from "@/modules/analytics/evaluation";
import { InstructorMetrics, StudentInteractions } from "@/modules/analytics/components/evaluation-tables";
import { CollegeCards, DailyByCollege, LevelConversions, type ConversionItem } from "@/modules/analytics/components/evaluation-sections";
import { TopicProgression } from "@/modules/analytics/components/topic-progression";
import { RISK_THRESHOLDS } from "@/common/domain/risk";

export const metadata = { title: "Analytics" };

const OUTCOME_LABEL: Record<string, string> = { Cleared: "Cleared", "In Progress": "In progress", "Need to Revisit": "Needs revisit" };
const fmt = (n: number) => n.toLocaleString("en-IN");
/** A file download (CSV of every interaction), not a page. */
const EXPORT_HREF = "/api/logs/interactions/export";

/** "+3.2 pts vs previous 30 days" style comparison; higher is better for every headline here. */
function compare(now: number | null, before: number | null, unit: "pts" | "count", days: number): { delta: string; trend: Trend } {
  if (now === null || before === null) return { delta: "", trend: "neutral" };
  const diff = Math.round((now - before) * 10) / 10;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const amount = unit === "pts" ? `${Math.abs(diff)} pts` : fmt(Math.abs(diff));
  return { delta: `${sign}${amount} ${days === 1 ? "vs the day before" : `vs previous ${days} days`}`, trend: diff > 0 ? "good" : diff < 0 ? "bad" : "neutral" };
}

function Headlines({ now, before, days, roster, levelUps }: { now: Headline; before: Headline; days: number; roster: number; levelUps: { now: number; before: number } }) {
  const cards = [
    { module: "Attendance", label: "Average attendance", value: now.attendancePct === null ? "—" : `${now.attendancePct}%`, sub: "Present ÷ marked, counted days", ...compare(now.attendancePct, before.attendancePct, "pts", days) },
    { module: "Interactions", label: "Interactions logged", value: fmt(now.interactions), sub: `${(now.interactions / days).toFixed(1)} a day`, ...compare(now.interactions, before.interactions, "count", days) },
    { module: "Interactions", label: "Students reached", value: fmt(now.studentsReached), sub: `of ${fmt(roster)} on the roster`, ...compare(now.studentsReached, before.studentsReached, "count", days) },
    { module: "DSA progress", label: "Level-ups", value: fmt(levelUps.now), sub: "Level conversions that count", ...compare(levelUps.now, levelUps.before, "count", days) },
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
      actions={
        <a
          href={EXPORT_HREF}
          download
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Download aria-hidden="true" className="size-4" />
          Export interactions (CSV)
        </a>
      }
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

  const [a, ev, conversions, roster, structure] = await Promise.all([
    getAnalytics(range.from, range.to),
    getEvaluation(range.from, range.to, today),
    getConversions(),
    getRoster(),
    getStructure(),
  ]);
  const days = eachDay(range);
  const byId = new Map(roster.map((s) => [s.niatId, s]));
  const colleges = [...new Set(roster.map((s) => s.college))].sort();

  // Level conversions in the chosen dates, for students still on the roster
  const toItem = (c: (typeof conversions)[number]): ConversionItem | null => {
    const s = byId.get(c.niatId);
    return s ? { niatId: c.niatId, name: s.name, college: s.college, instructor: s.instructor, from: c.from, date: c.date } : null;
  };
  const inDates = (from: string, to: string) => conversions.filter((c) => c.date >= from && c.date <= to);
  const counted = inDates(range.from, range.to)
    .filter((c) => c.counted)
    .map(toItem)
    .filter((c) => c !== null);
  const notCounted = inDates(range.from, range.to)
    .filter((c) => !c.counted)
    .map(toItem)
    .filter((c) => c !== null)
    .sort((x, y) => x.from - y.from || x.name.localeCompare(y.name));
  const levelUps = {
    now: counted.length,
    before: inDates(a.previousRange.from, a.previousRange.to).filter((c) => c.counted && byId.has(c.niatId)).length,
  };

  // Students per level and per current topic (curriculum order; topics nobody is on show 0)
  const levelCount = Math.max(structure.levels.length, 1);
  const perLevel = Array.from({ length: levelCount }, (_, level) => roster.filter((s) => s.level === level).length);
  const topicLevels = structure.levels.map((l) => {
    const here = roster.filter((s) => s.level === l.level);
    const names = l.topics.filter((t) => !t.archived).map((t) => t.name);
    for (const s of here) if (!names.includes(s.topic)) names.push(s.topic);
    return { level: l.level, title: l.title, students: here.length, topics: names.map((topic) => ({ topic, count: here.filter((s) => s.topic === topic).length })) };
  });

  // Day × college outcomes, latest day first
  const cells = new Map<string, OutcomeCounts>(ev.daily.map((d) => [`${d.day}|${d.college}`, d]));
  const dailyDays = [...days].reverse();

  const collegeCards = colleges.map((college) => {
    const c = ev.colleges.find((x) => x.college === college);
    return {
      college,
      students: roster.filter((s) => s.college === college).length,
      interactions: c?.interactions ?? 0,
      today: c?.today ?? 0,
      cleared: c?.cleared ?? 0,
      revisit: c?.revisit ?? 0,
    };
  });

  const perStudent = new Map(ev.students.map((s) => [s.niatId, s]));
  const studentRows = roster
    .map((s) => {
      const x = perStudent.get(s.niatId);
      return {
        niatId: s.niatId,
        name: s.name,
        college: s.college,
        instructor: s.instructor,
        level: s.level,
        standing: s.standing,
        interactions: x?.interactions ?? 0,
        cleared: x?.cleared ?? 0,
        revisits: x?.revisits ?? 0,
        last: x?.last ?? null,
      };
    })
    .sort((x, y) => y.interactions - x.interactions || x.name.localeCompare(y.name));
  const attendanceMap = new Map(a.attendanceByDay.map((d) => [d.day, d.pct]));
  const interactionMap = new Map(a.interactionsByDay.map((d) => [d.day, d.n]));
  const attendanceSeries = days.map((day) => ({ day, label: shortDay(day), value: attendanceMap.get(day) ?? null }));
  const interactionSeries = days.map((day) => ({ day, label: shortDay(day), value: interactionMap.get(day) ?? 0 }));
  const outcomesTotal = a.outcomes.reduce((n, o) => n + o.n, 0) || 1;

  return (
    <>
      {header}
      {filters}
      <Headlines now={a.headline} before={a.previous} days={range.days} roster={a.rosterSize} levelUps={levelUps} />

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
              valueWidth="5.5rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No interactions in these dates.</p>
          )}
        </SectionCard>
        <SectionCard title="Students per level" description={`Where the ${fmt(roster.length)} students are now`}>
          <BarList
            items={perLevel.map((n, level) => ({ label: `L${level}`, value: n, display: `${fmt(n)} · ${roster.length ? Math.round((n * 1000) / roster.length) / 10 : 0}%` }))}
            labelWidth="2.25rem"
            valueWidth="5.5rem"
          />
        </SectionCard>
      </div>

      <SectionCard title="Level conversions" description={`Students who moved up a level · ${shortDay(range.from)} – ${shortDay(range.to)} · open a row to see who`}>
        <LevelConversions counted={counted} notCounted={notCounted} colleges={colleges} levels={levelCount} />
      </SectionCard>

      <SectionCard title="Daily overview by college" description="Students interacted with each day and their outcome that day (the latest, if seen more than once)">
        <DailyByCollege days={dailyDays} colleges={colleges} cells={cells} today={today} />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="College-wise" description={`Interactions and outcomes · ${shortDay(range.from)} – ${shortDay(range.to)}`}>
          <CollegeCards cards={collegeCards} />
        </SectionCard>
        <SectionCard title="Current topic progression" description="Students on each topic right now">
          <TopicProgression levels={topicLevels} />
        </SectionCard>
      </div>

      <SectionCard title="Instructor metrics" description="Interactions each instructor took · last 3 and 7 days include today" bodyClassName="px-0 pb-2">
        <InstructorMetrics rows={ev.instructors} />
      </SectionCard>

      <SectionCard title="Student interaction analytics" description="Every student's interactions, all time · open a name for their history" bodyClassName="px-0 pb-2">
        <StudentInteractions rows={studentRows} />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Attendance by hall" description={`Below ${RISK_THRESHOLDS.attendancePct}% in orange`}>
          {a.attendanceByHall.length ? (
            <BarList
              items={a.attendanceByHall.map((h) => ({ label: h.hall, value: h.pct, display: `${h.pct}% · ${h.students}`, warn: h.pct < RISK_THRESHOLDS.attendancePct }))}
              max={100}
              labelWidth="4.5rem"
              valueWidth="5.5rem"
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
              valueWidth="5.5rem"
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
