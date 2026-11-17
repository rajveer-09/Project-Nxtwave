/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { authMode } from "@/common/auth/config";
import { expire, TAGS } from "@/common/data/cache";
import { getDb } from "@/common/db/pool";
import { riskFlags, type RiskInput } from "@/common/domain/risk";
import { todayIst } from "@/common/lib/dates";
import { ROSTER, type College, type RosterStudent } from "@/common/sample-data/roster";

/**
 * The combined roster every module reads: one row per student in core.students,
 * with the numbers each module contributes (attendance %, DSA level and progress,
 * interactions, LeetCode). In development without a database it is the sample roster.
 *
 * The database version is one query (web_svc reads every module schema), kept in the shared
 * cache: a minute fresh, rebuilt in the background after that, and expired the moment anything
 * that feeds it is written (interaction logged, assignment or class changed).
 */

/** Expire the roster (and what's built from it) after a write. */
export function invalidateRoster(niatId?: string) {
  expire(TAGS.roster, TAGS.home, ...(niatId ? [TAGS.student(niatId)] : []));
}

/** The roster for a given IST day; safe to call from other cached functions. */
export async function cachedRoster(today: string): Promise<RosterStudent[]> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.roster);
  return loadRoster(today);
}

export async function getRoster(): Promise<RosterStudent[]> {
  if (authMode() !== "database") return ROSTER;
  await connection(); // "today" is request-time
  return cachedRoster(todayIst());
}

export async function getRosterStudent(niatId: string): Promise<RosterStudent | null> {
  const id = niatId.trim().toUpperCase();
  return (await getRoster()).find((s) => s.niatId === id) ?? null;
}

/** Whether pages are showing real data (for the "Sample data" labels). */
export const usingSampleData = () => authMode() !== "database";

type Row = {
  niat_id: string;
  full_name: string;
  college: string;
  section: string;
  hall: string | null;
  joined_on: string | null;
  instructor: string | null;
  coach: string | null;
  poc: string | null;
  level: number | null;
  topic: string | null;
  subtopic: string | null;
  step: string | null;
  level_since: string | null;
  p30: number;
  m30: number;
  pterm: number;
  mterm: number;
  interactions: number;
  last_interaction: string | null;
  lc_handle: string | null;
  lc_rating: number | null;
  contests_attended: number | null;
  absent_streak: number | null;
};

/*
 * Attendance follows the attendance service's rules (modules/attendance/backend/internal/stats):
 * a mark counts only on a counted day (in a term, not before joining or after dropping,
 * not in the future; the degree's calendar entry, else ALL's, else Sunday off), and
 * % = present ÷ (present + absent), so unmarked days never count as absent.
 */
const ROSTER_SQL = `
WITH today AS (SELECT $1::date AS d),
term AS (
  SELECT start_date, end_date FROM attendance.terms
  WHERE (SELECT d FROM today) BETWEEN start_date AND end_date
  ORDER BY is_current DESC, start_date DESC LIMIT 1
),
marks AS (
  SELECT a.niat_id, a.date, a.status
  FROM attendance.attendance a
  JOIN attendance.students s ON s.niat_id = a.niat_id
  LEFT JOIN attendance.calendar_days cd ON cd.date = a.date AND cd.applies_to = s.degree_code
  LEFT JOIN attendance.calendar_days ca ON ca.date = a.date AND ca.applies_to = 'ALL'
  WHERE a.date <= (SELECT d FROM today)
    AND a.date >= LEAST((SELECT d FROM today) - 30, COALESCE((SELECT start_date FROM term), (SELECT d FROM today) - 30))
    AND (s.joined_on IS NULL OR a.date >= s.joined_on)
    AND (s.dropped_on IS NULL OR a.date <= s.dropped_on)
    AND EXISTS (SELECT 1 FROM attendance.terms t WHERE a.date BETWEEN t.start_date AND t.end_date)
    AND CASE
          WHEN cd.day_type IS NOT NULL THEN cd.day_type = 'working' OR (cd.day_type = 'event' AND cd.counts)
          WHEN ca.day_type IS NOT NULL THEN ca.day_type = 'working' OR (ca.day_type = 'event' AND ca.counts)
          ELSE extract(isodow FROM a.date) <> 7
        END
),
att AS (
  SELECT niat_id,
         count(*) FILTER (WHERE status = 'P' AND date >= (SELECT d FROM today) - 30)::int AS p30,
         count(*) FILTER (WHERE date >= (SELECT d FROM today) - 30)::int AS m30,
         count(*) FILTER (WHERE status = 'P' AND date >= (SELECT start_date FROM term))::int AS pterm,
         count(*) FILTER (WHERE date >= (SELECT start_date FROM term))::int AS mterm
  FROM marks GROUP BY niat_id
),
ints AS (
  SELECT upper(student_id) AS niat_id, count(*)::int AS n, max(date) AS last
  FROM logs.interactions GROUP BY 1
),
level_since AS (
  SELECT DISTINCT ON (upper(lc.student_id)) upper(lc.student_id) AS niat_id, lc.change_date
  FROM logs.level_changes lc JOIN logs.students ls ON ls.id = lc.student_id AND ls.level = lc.to_level
  ORDER BY upper(lc.student_id), lc.change_date DESC
),
lc AS (
  SELECT DISTINCT ON (upper(trim(c.roll_no))) upper(trim(c.roll_no)) AS niat_id,
         CASE WHEN c.handle_status <> 'invalid' THEN COALESCE(c.lc_username, c.lc_slug) END AS handle,
         round(c.lc_rating)::int AS rating, st.attended, st.absent_streak
  FROM contest.students c
  LEFT JOIN contest.student_stats st ON st.student_id = c.id AND st.win = 0
  WHERE c.active
  ORDER BY upper(trim(c.roll_no)), c.id
)
SELECT s.niat_id, s.full_name, s.college, s.section, s.hall, s.joined_on::text,
       ins.name AS instructor, coach.name AS coach, m.name AS poc,
       ls.level, ls.current_topic AS topic, ls.current_subtopic AS subtopic, ls.current_step AS step,
       COALESCE(lsn.change_date, ls.created_at::date)::text AS level_since,
       COALESCE(att.p30, 0) AS p30, COALESCE(att.m30, 0) AS m30,
       COALESCE(att.pterm, 0) AS pterm, COALESCE(att.mterm, 0) AS mterm,
       COALESCE(ints.n, 0) AS interactions, ints.last::text AS last_interaction,
       lc.handle AS lc_handle, lc.rating AS lc_rating, lc.attended AS contests_attended, lc.absent_streak
FROM core.students s
LEFT JOIN LATERAL (
  SELECT st.name FROM core.student_assignments a JOIN core.staff st ON st.id = a.staff_id
  WHERE a.niat_id = s.niat_id AND a.kind = 'instructor' AND a.to_date IS NULL LIMIT 1
) ins ON true
LEFT JOIN LATERAL (
  SELECT st.name FROM core.student_assignments a JOIN core.staff st ON st.id = a.staff_id
  WHERE a.niat_id = s.niat_id AND a.kind = 'coach' AND a.to_date IS NULL LIMIT 1
) coach ON true
LEFT JOIN attendance.students ast ON ast.niat_id = s.niat_id
LEFT JOIN attendance.mentors m ON m.id = ast.poc_id
LEFT JOIN logs.students ls ON upper(ls.id) = s.niat_id
LEFT JOIN level_since lsn ON lsn.niat_id = s.niat_id
LEFT JOIN att ON att.niat_id = s.niat_id
LEFT JOIN ints ON ints.niat_id = s.niat_id
LEFT JOIN lc ON lc.niat_id = s.niat_id
WHERE s.status = 'active'
ORDER BY s.full_name`;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);

export function daysBetween(fromYmd: string, toYmd: string) {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
}

async function loadRoster(today: string): Promise<RosterStudent[]> {
  const { rows } = await getDb().query<Row>(ROSTER_SQL, [today]);
  return rows.map((r) => {
    const attendance30d = pct(r.p30, r.m30);
    const lastInteractionDays = r.last_interaction ? Math.max(0, daysBetween(r.last_interaction, today)) : null;
    const risk: RiskInput = {
      attendance30d,
      daysSinceInteraction: lastInteractionDays,
      contestAbsentStreak: r.absent_streak ?? 0,
      weeksAtLevel: r.level_since ? Math.max(0, Math.floor(daysBetween(r.level_since, today) / 7)) : 0,
      // Weekly test results aren't recorded yet; the rule switches on once they are.
      testsBelowPassLast3: 0,
    };
    return {
      niatId: r.niat_id,
      name: r.full_name,
      college: r.college as College,
      section: r.section || "—",
      hall: r.hall ?? "—",
      instructor: r.instructor ?? "Unassigned",
      coach: r.coach ?? "",
      poc: r.poc ?? "Not assigned",
      level: r.level ?? 0,
      topic: r.topic || "Introduction",
      subtopic: r.subtopic || null,
      step: r.step || "",
      attendance30d,
      attendanceTerm: pct(r.pterm, r.mterm),
      lcHandle: r.lc_handle,
      lcRating: r.lc_rating,
      contestsAttended: r.contests_attended ?? 0,
      lastInteractionDays,
      interactions: r.interactions,
      lastTestScore: null,
      risk,
      flags: riskFlags(risk),
      joinedOn: r.joined_on ?? "",
    };
  });
}
