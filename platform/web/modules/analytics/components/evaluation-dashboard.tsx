/*

Author : Rajveer Sharma
Date : 25 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { CalendarCheck, Download, UserCheck, Users } from "lucide-react";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { BarList } from "@/common/components/bar-list";
import { PresentAbsentBars } from "@/common/components/charts";
import { DateRange } from "@/common/components/date-range";
import { LiveForm } from "@/common/components/live-form";
import { getRoster } from "@/common/data/roster";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import { STANDING_LABEL, STANDINGS, type Standing } from "@/common/domain/standing";
import { inScope, type StudentScope } from "@/common/auth/student-access";
import { eachDay, shortDay, type Range } from "@/common/lib/range";
import { cn } from "@/common/lib/utils";
import { getAttendanceOverview } from "@/modules/analytics/data";
import { getConversions, getEvaluation, type OutcomeCounts } from "@/modules/analytics/evaluation";
import { CollegeCards, DailyByCollege, LevelConversions, type ConversionItem } from "@/modules/analytics/components/evaluation-sections";
import { InstructorMetrics, StudentInteractions, type InstructorRow } from "@/modules/analytics/components/evaluation-tables";
import { TopicProgression } from "@/modules/analytics/components/topic-progression";

/**
 * The Instructor Evaluation app's Analytics page, section for section and in its order, with attendance
 * added: Home and Analytics both show it. Instructors and success coaches see only their own students.
 *
 *   header · today's tiles (interactions, then attendance) · level distribution | topic progression ·
 *   level conversions · daily overview by college · college-wise · attendance by day | by hall ·
 *   instructor metrics + detail · student analytics + detail
 */

/** A file download (CSV of the interactions the viewer can see), not a page. */
const EXPORT_HREF = "/api/logs/interactions/export";
const MIN = RISK_THRESHOLDS.attendancePct;
const fmt = (n: number) => n.toLocaleString("en-IN");

type Half = { college: string; value: React.ReactNode; note?: React.ReactNode; /** This college's final result, under its numbers. */ final?: React.ReactNode };

function CardTitle({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground sm:gap-2">
      <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0">{label}</span>
    </div>
  );
}

/** One row of per-college numbers: CDU | BITS side by side (one college fills the row). */
function CollegeRow({ halves, big }: { halves: Half[]; big?: boolean }) {
  return (
    <div className={cn("grid gap-3", halves.length > 1 && "grid-cols-2 divide-x divide-border")}>
      {halves.map((h, i) => (
        <div key={h.college} className={cn("flex min-w-0 flex-col", i > 0 && "pl-3")}>
          <span className="text-xs font-semibold text-muted-foreground">{h.college}</span>
          <span className={cn("font-heading leading-tight font-semibold tracking-tight tabular", big ? "mt-0.5 text-[28px] sm:text-[34px]" : "text-xl sm:text-2xl")}>{h.value}</span>
          {h.note ? <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{h.note}</span> : null}
          {h.final ? <span className="mt-2 border-t border-border pt-1.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{h.final}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** "Final record by 5 PM · pending" before that time; "Final record at 1 PM ✓" once it has passed. */
function FinalRecord({ at, due }: { at: string; due: boolean }) {
  return due ? (
    <span>
      <span className="font-semibold text-foreground">Final record at {at}</span>{" "}
      <span className="font-semibold text-chart-4" aria-label="done">✓</span>
    </span>
  ) : (
    <span>
      <span className="font-semibold text-foreground">Final record by {at}</span> · pending
    </span>
  );
}

/** An attendance card split into one half per college (CDU | BITS): big numbers centred, the note at the bottom. */
function HalvesCard({ icon, label, sub, halves }: { icon: typeof Users; label: string; sub?: React.ReactNode; halves: Half[] }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3.5 sm:p-4">
      <CardTitle icon={icon} label={label} />
      <div className="flex flex-1 flex-col justify-center py-1">
        <CollegeRow halves={halves} big />
      </div>
      {sub ? <div className="border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">{sub}</div> : null}
    </div>
  );
}

/**
 * Present on top, absent below (split across the middle). Colleges are the columns: each heading
 * carries that college's final record once (CDU by 1 PM, BITS by 5 PM).
 */
function StackedCard({
  icon,
  label,
  columns,
  rows,
}: {
  icon: typeof Users;
  label: string;
  columns: { college: string; final?: React.ReactNode }[];
  rows: { label: string; values: string[] }[];
}) {
  const grid = columns.length > 1 ? "grid grid-cols-2 divide-x divide-border" : "grid";
  return (
    <div className="flex h-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3.5 sm:p-4">
      <CardTitle icon={icon} label={label} />
      <div className={grid}>
        {columns.map((c, i) => (
          <div key={c.college} className={cn("flex min-w-0 flex-col", i > 0 && "pl-3")}>
            <span className="text-xs font-semibold text-muted-foreground">{c.college}</span>
            {c.final ? <span className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{c.final}</span> : null}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-center divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5 py-2 last:pb-0">
            <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{r.label}</span>
            <div className={grid}>
              {r.values.map((v, i) => (
                <span key={i} className={cn("font-heading text-xl leading-tight font-semibold tracking-tight tabular sm:text-2xl", i > 0 && "pl-3")}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gray not started, blue ongoing, red to redo, teal cleared (as in the DSA progress view).
const STANDING_DOT: Record<Standing, string> = {
  pending: "bg-muted-foreground/60",
  in_progress: "bg-primary",
  revisit: "bg-destructive",
  cleared: "bg-chart-4",
};

const STANDING_SUB: Record<Standing, string> = {
  pending: "at current level",
  in_progress: "evaluation ongoing",
  revisit: "re-evaluate",
  cleared: "ready for next level",
};

/** Where students stand at their current level; each card opens those students. */
function StandingTile({ href, label, value, sub, dot, className }: { href: string; label: string; value: string; sub: string; dot?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-4",
        className,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mt-2">
        <span className="font-heading text-2xl leading-tight font-semibold tracking-tight tabular sm:text-[28px]">{value}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
          {dot ? <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dot)} /> : null}
          {sub}
        </span>
      </span>
    </Link>
  );
}

function Panel({ title, action, description, className, children }: { title: string; action?: React.ReactNode; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-3.5 sm:p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** pageTitle: the page's heading for screen readers (the visible header is the eyebrow and the date controls). */
export async function EvaluationDashboard({
  range,
  today,
  scope,
  eyebrow,
  pageTitle = "Home",
}: {
  range: Range;
  today: string;
  scope: StudentScope | undefined;
  eyebrow?: React.ReactNode;
  pageTitle?: string;
}) {
  const roster = (await getRoster()).filter((s) => inScope(scope, s));
  const ids = scope ? roster.map((s) => s.niatId).sort() : null;
  const [ev, att, conversions, structure] = await Promise.all([
    getEvaluation(range.from, range.to, today, ids),
    getAttendanceOverview(range.from, range.to, today, ids),
    getConversions(),
    getStructure(),
  ]);
  const byId = new Map(roster.map((s) => [s.niatId, s]));
  const colleges = [...new Set(roster.map((s) => s.college))].sort();
  const dates = `${shortDay(range.from)} – ${shortDay(range.to)}`;

  // Tiles
  const standingCounts = Object.fromEntries(STANDINGS.map((st) => [st, roster.filter((s) => s.standing === st).length])) as Record<Standing, number>;
  // DSA attendance cards: one half per college (CDU first, then BITS). "Today" adds each college's final
  // result: CDU's attendance is final at 1 PM, BITS's at 5 PM (any other college shows both).
  const isToday = range.from === today && range.to === today;
  const ORDER = ["CDU", "BITS"];
  const FINAL_AT: Record<string, string> = { CDU: "1 PM", BITS: "5 PM" };
  const perCollege = att.coverage
    .filter((c): c is typeof c & { college: string } => c.college !== null && c.expected > 0)
    .sort((a, b) => (ORDER.indexOf(a.college) + 1 || 99) - (ORDER.indexOf(b.college) + 1 || 99));
  const nothingCounts = perCollege.length === 0;
  const halves = (
    value: (c: (typeof perCollege)[number]) => React.ReactNode,
    note?: (c: (typeof perCollege)[number]) => React.ReactNode,
    final?: (c: (typeof perCollege)[number]) => React.ReactNode,
  ): Half[] =>
    nothingCounts
      ? [{ college: isToday ? "Today" : dates, value: "—", note: isToday ? "Not a class day, or outside the term" : "No class days in these dates" }]
      : perCollege.map((c) => ({ college: c.college, value: value(c), note: note?.(c), final: final?.(c) }));
  // Today: each college's final result in its own half (CDU's at 1 PM, BITS's at 5 PM), "pending" until then.
  const finalOf = (c: (typeof perCollege)[number]) => {
    if (!isToday) return null;
    const at = FINAL_AT[c.college];
    const f = c.finals.find((x) => x.at === at) ?? c.finals[c.finals.length - 1];
    return <FinalRecord at={f.at} due={f.due} />;
  };
  const total = att.coverage.find((c) => c.college === null);
  const outOf = (n: number, of: number) => (
    <>
      {fmt(n)}
      <span className="text-base font-medium text-muted-foreground sm:text-lg">/{fmt(of)}</span>
    </>
  );

  // Level distribution and topic progression (curriculum order; topics nobody is on show 0)
  const levelCount = Math.max(structure.levels.length, 1);
  const perLevel = Array.from({ length: levelCount }, (_, level) => roster.filter((s) => s.level === level).length);
  const topicLevels = structure.levels.map((l) => {
    const here = roster.filter((s) => s.level === l.level);
    const names = l.topics.filter((t) => !t.archived).map((t) => t.name);
    for (const s of here) if (!names.includes(s.topic)) names.push(s.topic);
    return { level: l.level, title: l.title, students: here.length, topics: names.map((topic) => ({ topic, count: here.filter((s) => s.topic === topic).length })) };
  });

  // Level conversions in the chosen dates, for students in view
  const toItem = (c: (typeof conversions)[number]): ConversionItem | null => {
    const s = byId.get(c.niatId);
    return s ? { niatId: c.niatId, name: s.name, college: s.college, instructor: s.instructor, from: c.from, date: c.date } : null;
  };
  const inDates = conversions.filter((c) => c.date >= range.from && c.date <= range.to);
  const counted = inDates.filter((c) => c.counted).map(toItem).filter((c) => c !== null);
  const notCounted = inDates
    .filter((c) => !c.counted)
    .map(toItem)
    .filter((c) => c !== null)
    .sort((x, y) => x.from - y.from || x.name.localeCompare(y.name));

  // Day × college outcomes, latest day first
  const cells = new Map<string, OutcomeCounts>(ev.daily.map((d) => [`${d.day}|${d.college}`, d]));
  const days = eachDay(range);

  const collegeCards = colleges.map((college) => {
    const c = ev.colleges.find((x) => x.college === college);
    return {
      college,
      students: roster.filter((s) => s.college === college).length,
      interactions: c?.interactions ?? 0,
      today: c?.today ?? 0,
      cleared: c?.cleared ?? 0,
      revisit: c?.revisit ?? 0,
      attendance: att.byCollege.find((x) => x.college === college)?.pct ?? null,
    };
  });

  const attendanceByDay = new Map(att.byDay.map((d) => [d.day, d]));
  const attendanceSeries = days.map((day) => ({ day, label: shortDay(day), present: attendanceByDay.get(day)?.present ?? 0, absent: attendanceByDay.get(day)?.absent ?? 0 }));

  // Instructors: their interactions, and their assigned students' attendance (last 30 days)
  const assigned = new Map<string, { students: number; sum: number; n: number }>();
  for (const s of roster) {
    if (!s.instructor) continue;
    const a = assigned.get(s.instructor) ?? { students: 0, sum: 0, n: 0 };
    a.students++;
    if (s.attendance30d !== null) {
      a.sum += s.attendance30d;
      a.n++;
    }
    assigned.set(s.instructor, a);
  }
  const instructorRows: InstructorRow[] = ev.instructors.map((r) => {
    const a = assigned.get(r.name);
    return { ...r, students: a?.students ?? 0, attendance: a?.n ? Math.round(a.sum / a.n) : null };
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
        attendance30d: s.attendance30d,
        attendanceTerm: s.attendanceTerm,
      };
    })
    .sort((x, y) => y.interactions - x.interactions || x.name.localeCompare(y.name));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-3.5 sm:p-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-col gap-0.5 xl:max-w-xl">
          {eyebrow ? <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{eyebrow}</p> : null}
          <h1 className="sr-only">{pageTitle}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3 xl:shrink-0 xl:justify-end">
          <LiveForm className="flex min-w-0 flex-wrap items-end gap-3" aria-label="Choose dates">
            <DateRange from={range.from} to={range.to} today={today} />
          </LiveForm>
          <a
            href={EXPORT_HREF}
            download
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-semibold whitespace-nowrap hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-auto"
          >
            <Download aria-hidden="true" className="size-4 text-muted-foreground" />
            Export Summary (CSV)
          </a>
        </div>
      </header>

      <section aria-label="Where students stand" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <StandingTile href="/students" label="Total students" value={fmt(roster.length)} sub="across all levels" className="col-span-2 sm:col-span-1" />
        {STANDINGS.map((st) => (
          <StandingTile
            key={st}
            href={`/students?standing=${st}`}
            label={STANDING_LABEL[st]}
            value={fmt(standingCounts[st])}
            sub={STANDING_SUB[st]}
            dot={STANDING_DOT[st]}
          />
        ))}
      </section>

      <section aria-label="DSA attendance" className="grid gap-2.5 sm:gap-3 md:grid-cols-3">
        <HalvesCard
          icon={CalendarCheck}
          label={isToday ? "DSA Attendance Today" : "DSA Attendance"}
          sub={isToday ? undefined : `Present out of student-days that count · ${dates}`}
          halves={halves(
            (c) => outOf(c.present, c.expected),
            (c) => (
              <>
                present · <span className={cn(c.expected - c.marked > 0 && "font-semibold text-warning")}>{fmt(c.expected - c.marked)} unmarked</span>
              </>
            ),
            finalOf,
          )}
        />
        {perCollege.length > 1 && total ? (
          <HalvesCard
            icon={Users}
            label={isToday ? "DSA Total Present Today" : "DSA Total Present"}
            sub={
              isToday ? (
                (() => {
                  // Everyone's final result is at 5 PM (when BITS, the later college, is final).
                  const f = total.finals.find((x) => x.at === "5 PM");
                  return <FinalRecord at="5 PM" due={!!f?.due} />;
                })()
              ) : (
                `CDU and BITS together · ${dates}`
              )
            }
            halves={[
              {
                college: perCollege.map((c) => c.college).join(" + "),
                value: outOf(total.present, total.expected),
                note: (
                  <>
                    present · <span className={cn(total.expected - total.marked > 0 && "font-semibold text-warning")}>{fmt(total.expected - total.marked)} unmarked</span>
                  </>
                ),
              },
            ]}
          />
        ) : null}
        <StackedCard
          icon={UserCheck}
          label={isToday ? "DSA Present & Absent Today" : `DSA Present & Absent · ${dates}`}
          columns={nothingCounts ? [{ college: isToday ? "Today" : dates }] : perCollege.map((c) => ({ college: c.college, final: finalOf(c) }))}
          rows={[
            { label: "Present", values: nothingCounts ? ["—"] : perCollege.map((c) => fmt(c.present)) },
            { label: "Absent", values: nothingCounts ? ["—"] : perCollege.map((c) => fmt(c.marked - c.present)) },
          ]}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Level Distribution" action={<span className="text-xs text-muted-foreground">{fmt(roster.length)} students</span>}>
          <BarList
            items={perLevel.map((n, level) => ({
              label: `Level ${level}`,
              value: n,
              display: `${fmt(n)} (${roster.length ? ((n * 100) / roster.length).toFixed(1) : "0.0"}%)`,
            }))}
            max={Math.max(roster.length, 1)}
            labelWidth="3.75rem"
            valueWidth="6rem"
            className="gap-3"
          />
        </Panel>
        <Panel title="Current Topic Progression">
          <TopicProgression levels={topicLevels} />
        </Panel>
      </div>

      <Panel title="Level Conversions" description={`Students who moved up a level · ${dates} · open a row to see who`}>
        <LevelConversions counted={counted} notCounted={notCounted} colleges={colleges} levels={levelCount} />
      </Panel>

      <Panel title="Daily Overview by College" description="Students interacted with each day and their outcome that day (the latest, if seen more than once)">
        <DailyByCollege days={[...days].reverse()} colleges={colleges} cells={cells} today={today} />
      </Panel>

      <Panel title="College-wise Analytics" description={`Interactions, outcomes and attendance · ${dates} · Today is today's interactions`}>
        <CollegeCards cards={collegeCards} attendanceMin={MIN} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="DSA Attendance by Day" description="Students present and absent each day · counted days · days off are empty">
          <PresentAbsentBars data={attendanceSeries} />
          <p className="sr-only">
            {attendanceSeries
              .filter((d) => d.present + d.absent > 0)
              .map((d) => `${d.label}: ${d.present} present, ${d.absent} absent`)
              .join(", ")}
          </p>
        </Panel>
        <Panel title="DSA Attendance by Hall" description={`${dates} · below ${MIN}% in orange · students marked`}>
          {att.byHall.length ? (
            <BarList
              items={att.byHall.map((h) => ({ label: h.hall, value: h.pct, display: `${h.pct}% · ${h.students}`, warn: h.pct < MIN }))}
              max={100}
              labelWidth="4.5rem"
              valueWidth="5.5rem"
            />
          ) : (
            <p className="text-[13px] text-muted-foreground">Nothing marked in these dates.</p>
          )}
        </Panel>
      </div>

      <InstructorMetrics rows={instructorRows} />

      <StudentInteractions rows={studentRows} />
    </div>
  );
}
