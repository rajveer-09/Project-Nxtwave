/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import type { BarListItem } from "@/common/components/bar-list";
import { getRoster, usingSampleData } from "@/common/data/roster";
import { getDb } from "@/common/db/pool";
import { FLAG_LABEL, RISK_THRESHOLDS } from "@/common/domain/risk";
import { formatDate, todayIst } from "@/common/lib/dates";
import * as sample from "@/modules/home/sample-data";
import { getSessionUser } from "@/common/auth/session";
import { inScope, studentScope } from "@/common/auth/student-access";
import type { AtRiskStudent, HomeKpi } from "@/modules/home/sample-data";

/**
 * Home page numbers. From the combined database when it's connected (roster, attendance,
 * logs and contest schemas), otherwise the fixed sample numbers.
 */

export type HomeData = {
  sample: boolean;
  dateLabel: string;
  kpis: HomeKpi[];
  atRisk: AtRiskStudent[];
  atRiskTotal: number;
  students: number;
  levels: BarListItem[];
  halls: BarListItem[];
  todo: { href: string; label: string; urgent: boolean }[];
  contest: { name: string; date: string; state: string; tookPart: number; medianSolved: string; bestGlobalRank: string } | null;
};

const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`;
const pctOf = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : null);

/**
 * The headline numbers: for the whole cohort, or (ids) only an instructor's or coach's own students.
 * Shared by everyone with the same view and kept a minute.
 */
async function homeQueries(today: string, ids: string[] | null) {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.home, TAGS.roster, TAGS.interactions);
  const db = getDb();
  const [day, interactions, contests, drafts, offRoadmap, term] = await Promise.all([
    // Latest day with marks (today if marking has started), and the same weekday a week earlier
    db.query<{ date: string; present: number; marked: number; halls_marked: number; halls_total: number; prev_present: number; prev_marked: number }>(
      `WITH latest AS (SELECT max(date) AS d FROM attendance.attendance WHERE date <= $1::date),
            active AS (SELECT niat_id, hall_no FROM attendance.students WHERE status = 'active' AND ($2::text[] IS NULL OR niat_id = ANY($2::text[])))
       SELECT (SELECT d FROM latest)::text AS date,
              count(*) FILTER (WHERE a.date = (SELECT d FROM latest) AND a.status = 'P')::int AS present,
              count(*) FILTER (WHERE a.date = (SELECT d FROM latest))::int AS marked,
              count(DISTINCT s.hall_no) FILTER (WHERE a.date = (SELECT d FROM latest))::int AS halls_marked,
              (SELECT count(DISTINCT hall_no) FROM active WHERE hall_no IS NOT NULL)::int AS halls_total,
              count(*) FILTER (WHERE a.date = (SELECT d FROM latest) - 7 AND a.status = 'P')::int AS prev_present,
              count(*) FILTER (WHERE a.date = (SELECT d FROM latest) - 7)::int AS prev_marked
       FROM attendance.attendance a JOIN active s ON s.niat_id = a.niat_id
       WHERE a.date IN ((SELECT d FROM latest), (SELECT d FROM latest) - 7)`,
      [today, ids],
    ),
    db.query<{ this_week: number; last_week: number }>(
      `SELECT count(*) FILTER (WHERE date > $1::date - 7)::int AS this_week,
              count(*) FILTER (WHERE date <= $1::date - 7 AND date > $1::date - 14)::int AS last_week
       FROM logs.interactions WHERE date > $1::date - 14 AND date <= $1::date AND ($2::text[] IS NULL OR upper(student_id) = ANY($2::text[]))`,
      [today, ids],
    ),
    db.query<{ slug: string; title: string; start_time: string; took_part: number; handles: number; median_solved: number | null; best_rank: number | null; kind: string | null }>(
      `SELECT ct.slug, ct.title, ct.start_time::text,
              count(*) FILTER (WHERE r.status IN ('solved', 'zero'))::int AS took_part,
              count(*) FILTER (WHERE r.status NOT IN ('no_handle', 'invalid_handle', 'duplicate_handle'))::int AS handles,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY r.solved_count) FILTER (WHERE r.status IN ('solved', 'zero')) AS median_solved,
              min(r.global_rank) FILTER (WHERE r.status IN ('solved', 'zero')) AS best_rank,
              (SELECT kind FROM contest.scan_runs sr WHERE sr.contest_slug = ct.slug AND sr.status = 'done' ORDER BY sr.finished_at DESC NULLS LAST LIMIT 1) AS kind
       FROM contest.contests ct JOIN contest.results r ON r.contest_slug = ct.slug
       JOIN contest.students cst ON cst.id = r.student_id
       WHERE $1::text[] IS NULL OR upper(cst.roll_no) = ANY($1::text[])
       GROUP BY ct.slug ORDER BY ct.start_time DESC LIMIT 2`,
      [ids],
    ),
    db.query<{ n: number }>("SELECT count(*)::int AS n FROM contest.scan_drafts"),
    db.query<{ n: number }>("SELECT count(*)::int AS n FROM logs.interactions WHERE questions_asked ILIKE '%(off-roadmap)%'"),
    db.query<{ name: string }>("SELECT name FROM attendance.terms WHERE $1::date BETWEEN start_date AND end_date ORDER BY is_current DESC LIMIT 1", [today]),
  ]);

  return {
    day: { rows: day.rows },
    interactions: { rows: interactions.rows },
    contests: { rows: contests.rows },
    drafts: { rows: drafts.rows },
    offRoadmap: { rows: offRoadmap.rows },
    term: { rows: term.rows },
  };
}

/** Cached per request: the header and the body both read it. */
export const getHomeData = cache(loadHomeData);

async function loadHomeData(): Promise<HomeData> {
  await connection();
  const today = todayIst();
  const dateLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (usingSampleData()) {
    return {
      sample: true,
      dateLabel: "Monday, 16 Nov 2026 · Term 5",
      kpis: sample.homeKpis,
      atRisk: sample.atRiskStudents,
      atRiskTotal: 47,
      students: 964,
      levels: sample.levelDistribution,
      halls: sample.hallAttendance,
      todo: sample.adminTodo,
      contest: { ...sample.latestContest, date: sample.latestContest.date, state: "Final", bestGlobalRank: sample.latestContest.bestGlobalRank },
    };
  }

  // Instructors and success coaches see their own students; everyone else the whole roster.
  const scope = studentScope(await getSessionUser());
  const roster = (await getRoster()).filter((s) => inScope(scope, s));
  const { day, interactions, contests, drafts, offRoadmap, term } = await homeQueries(today, scope ? roster.map((s) => s.niatId).sort() : null);

  // ---- attendance
  const d = day.rows[0];
  const withAttendance = roster.filter((s) => s.attendance30d !== null);
  const avg30 = withAttendance.length ? Math.round((withAttendance.reduce((n, s) => n + (s.attendance30d ?? 0), 0) / withAttendance.length) * 10) / 10 : null;
  const below = withAttendance.filter((s) => (s.attendance30d ?? 100) < RISK_THRESHOLDS.attendancePct).length;
  const todayPct = d ? pctOf(d.present, d.marked) : null;
  const prevPct = d ? pctOf(d.prev_present, d.prev_marked) : null;
  const hallsLeft = d && d.date === today ? d.halls_total - d.halls_marked : 0;

  // ---- interactions
  const w = interactions.rows[0] ?? { this_week: 0, last_week: 0 };
  const overdue = roster.filter((s) => s.lastInteractionDays === null || s.lastInteractionDays >= RISK_THRESHOLDS.interactionGapDays).length;

  // ---- contests
  const [latest, previous] = contests.rows;
  const participation = latest ? pctOf(latest.took_part, latest.handles) : null;
  const prevParticipation = previous ? pctOf(previous.took_part, previous.handles) : null;

  const kpis: HomeKpi[] = [
    {
      module: "Attendance",
      label: d?.date === today ? "Present today" : d?.date ? `Present on ${formatDate(d.date)}` : "Present today",
      value: todayPct === null ? "—" : `${todayPct}%`,
      sub: d?.marked ? `${d.present} of ${d.marked} marked${hallsLeft > 0 ? ` · ${hallsLeft} hall${hallsLeft === 1 ? "" : "s"} not marked yet` : ""}` : "Nothing marked yet",
      delta: todayPct !== null && prevPct !== null ? `${signed(Math.round((todayPct - prevPct) * 10) / 10, " pts")} vs a week earlier` : "",
      trend: todayPct !== null && prevPct !== null ? (todayPct >= prevPct ? "good" : "bad") : "neutral",
    },
    {
      module: "Attendance",
      label: "Last 30 days",
      value: avg30 === null ? "—" : `${avg30}%`,
      sub: `${below} student${below === 1 ? "" : "s"} below ${RISK_THRESHOLDS.attendancePct}%`,
      delta: "",
      trend: "neutral",
    },
    {
      module: "Interactions",
      label: "Logged this week",
      value: String(w.this_week),
      sub: `${overdue} students with none in ${RISK_THRESHOLDS.interactionGapDays}+ days`,
      delta: `${signed(w.this_week - w.last_week)} vs last week`,
      trend: w.this_week >= w.last_week ? "good" : "bad",
    },
    {
      module: "Contests",
      label: latest ? `${latest.title.replace(/^(Weekly|Biweekly) Contest /, "$1 ")} participation` : "Contest participation",
      value: participation === null ? "—" : `${Math.round(participation)}%`,
      sub: latest ? `${latest.took_part} of ${latest.handles} students with a handle` : "No contest scanned yet",
      delta: participation !== null && prevParticipation !== null ? `${signed(Math.round(participation - prevParticipation), " pts")} vs previous contest` : "",
      trend: participation !== null && prevParticipation !== null ? (participation >= prevParticipation ? "good" : "bad") : "neutral",
    },
  ];

  // ---- at risk: most flags first, then lowest attendance
  const flagged = roster
    .filter((s) => s.flags.length)
    .sort((a, b) => b.flags.length - a.flags.length || (a.attendance30d ?? 101) - (b.attendance30d ?? 101) || a.name.localeCompare(b.name));
  const atRisk: AtRiskStudent[] = flagged.slice(0, 8).map((s) => ({
    niatId: s.niatId,
    name: s.name,
    college: s.college,
    section: s.section,
    hall: s.hall,
    attendance30d: s.attendance30d,
    lastInteractionDays: s.lastInteractionDays,
    contestsAttended: s.contestsAttended,
    flags: s.flags.map((f) => (f === "contests" ? `Missed ${s.risk.contestAbsentStreak} contests` : f === "level" ? `L${s.level} for ${s.risk.weeksAtLevel} weeks` : FLAG_LABEL[f])),
  }));

  // ---- distributions
  const levels = Array.from({ length: 8 }, (_, level) => ({ label: `L${level}`, value: roster.filter((s) => s.level === level).length }));
  const byHall = new Map<string, number[]>();
  for (const s of withAttendance) {
    if (!byHall.has(s.hall)) byHall.set(s.hall, []);
    byHall.get(s.hall)!.push(s.attendance30d ?? 0);
  }
  const halls = [...byHall.entries()]
    .filter(([hall]) => hall !== "—")
    .map(([hall, values]) => ({ hall, value: Math.round(values.reduce((n, v) => n + v, 0) / values.length) }))
    .sort((a, b) => Number(a.hall.match(/\d+/)?.[0] ?? 999) - Number(b.hall.match(/\d+/)?.[0] ?? 999))
    .map(({ hall, value }) => ({ label: hall, value, display: `${value}%`, warn: value < RISK_THRESHOLDS.attendancePct }));

  const todo = [
    ...(offRoadmap.rows[0]?.n ? [{ href: "/admin/curriculum", label: `Off-roadmap questions logged in ${offRoadmap.rows[0].n} interaction${offRoadmap.rows[0].n === 1 ? "" : "s"}`, urgent: false }] : []),
    ...(hallsLeft > 0 ? [{ href: "/attendance", label: `${hallsLeft} hall${hallsLeft === 1 ? "" : "s"} not marked today`, urgent: true }] : []),
    ...(drafts.rows[0]?.n ? [{ href: "/contests", label: `${drafts.rows[0].n} contest scan draft${drafts.rows[0].n === 1 ? "" : "s"} awaiting review`, urgent: false }] : []),
  ];

  return {
    sample: false,
    dateLabel: `${dateLabel}${term.rows[0] ? ` · ${term.rows[0].name}` : ""}`,
    kpis,
    atRisk,
    atRiskTotal: flagged.length,
    students: roster.length,
    levels,
    halls,
    todo,
    contest: latest
      ? {
          name: latest.title,
          date: new Date(Number(latest.start_time) * 1000).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }),
          state: latest.kind === "final" ? "Final" : "Provisional",
          tookPart: latest.took_part,
          medianSolved: latest.median_solved === null ? "—" : `${latest.median_solved} / 4`,
          bestGlobalRank: latest.best_rank === null ? "—" : latest.best_rank.toLocaleString("en-IN"),
        }
      : null,
  };
}

