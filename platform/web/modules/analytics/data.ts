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
  SELECT a.niat_id, a.date, a.status, s.hall_no
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
