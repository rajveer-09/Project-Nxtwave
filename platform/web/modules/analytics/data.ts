/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import { getDb } from "@/common/db/pool";
import { addDays } from "@/common/lib/dates";
import { daysBetween } from "@/common/lib/range";

/**
 * Cohort analytics for a date range (Analytics page, admins). One shared, cached result per range.
 * Attendance follows the attendance service's counting rules (counted days only; % = present ÷
 * marked). Each headline number also comes for the previous period of the same length. Level-ups
 * follow the conversion rule in modules/analytics/evaluation.ts and are counted on the page.
 */

const COUNTED_MARKS = `
  SELECT a.niat_id, a.date, a.status, a.updated_at, s.hall_no
  FROM attendance.attendance a
  JOIN attendance.students s ON s.niat_id = a.niat_id AND s.status = 'active'
  LEFT JOIN attendance.calendar_days cd ON cd.date = a.date AND cd.applies_to = s.degree_code
  LEFT JOIN attendance.calendar_days ca ON ca.date = a.date AND ca.applies_to = 'ALL'
  WHERE a.date BETWEEN $1::date AND $2::date
    AND (s.joined_on IS NULL OR a.date >= s.joined_on)
    AND EXISTS (SELECT 1 FROM attendance.terms t WHERE a.date BETWEEN t.start_date AND t.end_date)
    AND CASE
          WHEN cd.day_type IS NOT NULL THEN cd.day_type = 'working' OR (cd.day_type = 'event' AND cd.counts)
          WHEN ca.day_type IS NOT NULL THEN ca.day_type = 'working' OR (ca.day_type = 'event' AND ca.counts)
          ELSE extract(isodow FROM a.date) <> 7
        END`;

/** Counted marks between $1 and $2 of the students in $3 (null: everyone), with each student's college. */
const SCOPED_MARKS = `
  SELECT m.*, COALESCE(cs.college, 'Other') AS college
  FROM (${COUNTED_MARKS}) m
  LEFT JOIN core.students cs ON cs.niat_id = m.niat_id
  WHERE $3::text[] IS NULL OR m.niat_id = ANY($3::text[])`;

type Marks = { present: number; absent: number; pct: number | null };
export type AttendanceOverview = {
  /** Marks on today's date (nothing marked yet, or a day off: all zero). */
  today: Marks;
  /** Every counted mark in the chosen dates. */
  period: Marks & { students: number };
  byDay: { day: string; pct: number | null }[];
  byHall: { hall: string; pct: number; students: number }[];
  /** The chosen dates per college (students: how many have a mark). */
  byCollege: (Marks & { college: string; students: number })[];
  /**
   * Per college (college null: everyone) for the chosen dates: `expected` is every student-day that
   * counts (a student whose day counts, on a counted day up to today), `marked`/`present` of those.
   * `finals` is the same as of 1 PM and 5 PM IST on the last day, `due` once that time has come.
   */
  coverage: Coverage[];
};

export type Coverage = {
  college: string | null;
  expected: number;
  marked: number;
  present: number;
  finals: { at: "1 PM" | "5 PM"; due: boolean; marked: number; present: number }[];
};

/**
 * Every student-day that counts from $1 to $2 (active students of $3, null: everyone; after joining,
 * inside a term, on a day their degree's calendar counts), with its mark if any, per college and in
 * total. m1/p1 and m2/p2: marks saved by the times in $4 (1 PM and 5 PM IST on the last day).
 */
const EXPECTED_SQL = `
WITH days AS (SELECT d::date AS d FROM generate_series($1::date, $2::date, interval '1 day') d),
expected AS (
  SELECT s.niat_id, days.d, COALESCE(cs.college, 'Other') AS college
  FROM attendance.students s
  CROSS JOIN days
  LEFT JOIN core.students cs ON cs.niat_id = s.niat_id
  LEFT JOIN attendance.calendar_days cd ON cd.date = days.d AND cd.applies_to = s.degree_code
  LEFT JOIN attendance.calendar_days ca ON ca.date = days.d AND ca.applies_to = 'ALL'
  WHERE s.status = 'active'
    AND (s.joined_on IS NULL OR days.d >= s.joined_on)
    AND ($3::text[] IS NULL OR s.niat_id = ANY($3::text[]))
    AND EXISTS (SELECT 1 FROM attendance.terms t WHERE days.d BETWEEN t.start_date AND t.end_date)
    AND CASE
          WHEN cd.day_type IS NOT NULL THEN cd.day_type = 'working' OR (cd.day_type = 'event' AND cd.counts)
          WHEN ca.day_type IS NOT NULL THEN ca.day_type = 'working' OR (ca.day_type = 'event' AND ca.counts)
          ELSE extract(isodow FROM days.d) <> 7
        END
)
SELECT e.college,
       count(*)::int AS expected,
       count(a.niat_id)::int AS marked,
       count(*) FILTER (WHERE a.status = 'P')::int AS present,
       count(a.niat_id) FILTER (WHERE a.updated_at <= ($4::timestamptz[])[1])::int AS m1,
       count(*) FILTER (WHERE a.status = 'P' AND a.updated_at <= ($4::timestamptz[])[1])::int AS p1,
       count(a.niat_id) FILTER (WHERE a.updated_at <= ($4::timestamptz[])[2])::int AS m2,
       count(*) FILTER (WHERE a.status = 'P' AND a.updated_at <= ($4::timestamptz[])[2])::int AS p2
FROM expected e
LEFT JOIN attendance.attendance a ON a.niat_id = e.niat_id AND a.date = e.d
GROUP BY ROLLUP (e.college)`;

/** Today's final updates (IST). */
const FINALS = [
  { at: "1 PM", time: "13:00" },
  { at: "5 PM", time: "17:00" },
] as const;

/**
 * Attendance for the evaluation dashboard (Home and Analytics): today, the chosen dates, per day, per hall and
 * per college. `ids` limits it to those students (an instructor's or coach's own); null is everyone.
 */
export async function getAttendanceOverview(from: string, to: string, today: string, ids: string[] | null = null): Promise<AttendanceOverview> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  cacheTag(TAGS.roster, TAGS.home);
  const db = getDb();
  type Row = { p: number; m: number };
  const finalAt = FINALS.map((f) => `${to}T${f.time}:00+05:30`);
  const [day, period, byDay, byHall, byCollege, coverage] = await Promise.all([
    db.query<Row>(`SELECT count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m FROM (${SCOPED_MARKS}) x`, [today, today, ids]),
    db.query<Row & { students: number }>(
      `SELECT count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m, count(DISTINCT niat_id)::int AS students FROM (${SCOPED_MARKS}) x`,
      [from, to, ids],
    ),
    db.query<Row & { day: string }>(`SELECT date::text AS day, count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m FROM (${SCOPED_MARKS}) x GROUP BY 1 ORDER BY 1`, [from, to, ids]),
    db.query<Row & { hall: string; students: number }>(
      `SELECT COALESCE(hall_no, 'No hall') AS hall, count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m, count(DISTINCT niat_id)::int AS students
       FROM (${SCOPED_MARKS}) x GROUP BY 1`,
      [from, to, ids],
    ),
    db.query<Row & { college: string; students: number }>(
      `SELECT college, count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m, count(DISTINCT niat_id)::int AS students FROM (${SCOPED_MARKS}) x GROUP BY 1`,
      [from, to, ids],
    ),
    db.query<{ college: string | null; expected: number; marked: number; present: number; m1: number; p1: number; m2: number; p2: number }>(EXPECTED_SQL, [
      from,
      to < today ? to : today,
      ids,
      finalAt,
    ]),
  ]);
  const marks = (r: Row): Marks => ({ present: r.p, absent: r.m - r.p, pct: pct(r.p, r.m) });
  return {
    today: marks(day.rows[0]),
    period: { ...marks(period.rows[0]), students: period.rows[0].students },
    byDay: byDay.rows.map((r) => ({ day: r.day, pct: pct(r.p, r.m) })),
    byHall: byHall.rows
      .filter((r) => r.m > 0)
      .map((r) => ({ hall: r.hall, pct: Math.round((r.p * 100) / r.m), students: r.students }))
      .sort((a, b) => Number(a.hall.match(/\d+/)?.[0] ?? 999) - Number(b.hall.match(/\d+/)?.[0] ?? 999)),
    byCollege: byCollege.rows.map((r) => ({ college: r.college, students: r.students, ...marks(r) })),
    coverage: coverage.rows.map((r) => ({
      college: r.college,
      expected: r.expected,
      marked: r.marked,
      present: r.present,
      finals: [
        { at: FINALS[0].at, due: Date.now() >= Date.parse(finalAt[0]), marked: r.m1, present: r.p1 },
        { at: FINALS[1].at, due: Date.now() >= Date.parse(finalAt[1]), marked: r.m2, present: r.p2 },
      ],
    })),
  };
}

export type Headline = { attendancePct: number | null; interactions: number; studentsReached: number; contestParticipation: number | null };
export type Analytics = {
  headline: Headline;
  previous: Headline;
  /** The period `previous` covers: the same number of days just before. */
  previousRange: { from: string; to: string };
  rosterSize: number;
  attendanceByDay: { day: string; pct: number | null }[];
  attendanceByHall: { hall: string; pct: number; students: number }[];
  interactionsByDay: { day: string; n: number }[];
  outcomes: { status: string; n: number }[];
  topInstructors: { name: string; n: number }[];
  contests: { title: string; day: string; tookPart: number; handles: number }[];
};

const pct = (p: number, m: number) => (m ? Math.round((p * 1000) / m) / 10 : null);

async function headline(from: string, to: string): Promise<Headline> {
  const db = getDb();
  const [att, ints, ct] = await Promise.all([
    db.query<{ p: number; m: number }>(`SELECT count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m FROM (${COUNTED_MARKS}) x`, [from, to]),
    db.query<{ n: number; students: number }>(
      "SELECT count(*)::int AS n, count(DISTINCT upper(student_id))::int AS students FROM logs.interactions WHERE date BETWEEN $1::date AND $2::date",
      [from, to],
    ),
    db.query<{ took: number; handles: number }>(
      `SELECT count(*) FILTER (WHERE r.status IN ('solved', 'zero'))::int AS took,
              count(*) FILTER (WHERE r.status NOT IN ('no_handle', 'invalid_handle', 'duplicate_handle'))::int AS handles
       FROM contest.results r JOIN contest.contests c ON c.slug = r.contest_slug
       WHERE to_timestamp(c.start_time) AT TIME ZONE 'Asia/Kolkata' BETWEEN $1::date AND $2::date + 1`,
      [from, to],
    ),
  ]);
  return {
    attendancePct: pct(att.rows[0].p, att.rows[0].m),
    interactions: ints.rows[0].n,
    studentsReached: ints.rows[0].students,
    contestParticipation: pct(ct.rows[0].took, ct.rows[0].handles),
  };
}

export async function getAnalytics(from: string, to: string): Promise<Analytics> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  cacheTag(TAGS.roster, TAGS.interactions, TAGS.home);
  const db = getDb();
  const span = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(span - 1));

  const [now, before, byDay, byHall, intsByDay, outcomes, top, contests, roster] = await Promise.all([
    headline(from, to),
    headline(prevFrom, prevTo),
    db.query<{ day: string; p: number; m: number }>(`SELECT date::text AS day, count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m FROM (${COUNTED_MARKS}) x GROUP BY 1 ORDER BY 1`, [from, to]),
    db.query<{ hall: string; p: number; m: number; students: number }>(
      `SELECT COALESCE(hall_no, 'No hall') AS hall, count(*) FILTER (WHERE status = 'P')::int AS p, count(*)::int AS m, count(DISTINCT niat_id)::int AS students
       FROM (${COUNTED_MARKS}) x GROUP BY 1`,
      [from, to],
    ),
    db.query<{ day: string; n: number }>("SELECT date::text AS day, count(*)::int AS n FROM logs.interactions WHERE date BETWEEN $1::date AND $2::date GROUP BY 1", [from, to]),
    db.query<{ status: string; n: number }>(
      "SELECT status_post_interaction AS status, count(*)::int AS n FROM logs.interactions WHERE date BETWEEN $1::date AND $2::date GROUP BY 1 ORDER BY 2 DESC",
      [from, to],
    ),
    db.query<{ name: string; n: number }>(
      "SELECT instructor_name AS name, count(*)::int AS n FROM logs.interactions WHERE date BETWEEN $1::date AND $2::date GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10",
      [from, to],
    ),
    db.query<{ title: string; day: string; took: number; handles: number }>(
      `SELECT c.title, (to_timestamp(c.start_time) AT TIME ZONE 'Asia/Kolkata')::date::text AS day,
              count(*) FILTER (WHERE r.status IN ('solved', 'zero'))::int AS took,
              count(*) FILTER (WHERE r.status NOT IN ('no_handle', 'invalid_handle', 'duplicate_handle'))::int AS handles
       FROM contest.contests c JOIN contest.results r ON r.contest_slug = c.slug
       WHERE to_timestamp(c.start_time) AT TIME ZONE 'Asia/Kolkata' BETWEEN $1::date AND $2::date + 1
       GROUP BY c.slug ORDER BY min(c.start_time)`,
      [from, to],
    ),
    db.query<{ n: number }>("SELECT count(*)::int AS n FROM core.students WHERE status = 'active'"),
  ]);

  return {
    headline: now,
    previous: before,
    previousRange: { from: prevFrom, to: prevTo },
    rosterSize: roster.rows[0].n,
    attendanceByDay: byDay.rows.map((r) => ({ day: r.day, pct: pct(r.p, r.m) })),
    attendanceByHall: byHall.rows
      .filter((r) => r.m > 0)
      .map((r) => ({ hall: r.hall, pct: Math.round((r.p * 100) / r.m), students: r.students }))
      .sort((a, b) => Number(a.hall.match(/\d+/)?.[0] ?? 999) - Number(b.hall.match(/\d+/)?.[0] ?? 999)),
    interactionsByDay: intsByDay.rows,
    outcomes: outcomes.rows,
    topInstructors: top.rows,
    contests: contests.rows.map((r) => ({ title: r.title, day: r.day, tookPart: r.took, handles: r.handles })),
  };
}
