/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import { getDb } from "@/common/db/pool";
import { addDays, todayIst } from "@/common/lib/dates";
import type { RosterStudent } from "@/common/sample-data/roster";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { studentSteps, subtopicNames, type Structure } from "@nxtone/interactions-ui/curriculum/lib/structure";
import type { Attendance, AutoFill, RoadmapProgress, WeeklyTest } from "./types";

/*
 * What a weekly test fills in for the instructor and the report, per student: attendance this
 * semester (the term the test day falls in, from its start up to the test day), attendance in the
 * week up to the test day (7 days), and where the student is on their roadmap. Saved with the result
 * when the instructor saves (data.ts saveResults), so a report of an old test shows what was true then.
 *
 * Attendance follows the same counting rules as the roster (common/data/roster.ts): a mark counts only
 * on a counted day (in a term, between joining and dropping, the degree's calendar, else ALL's, else
 * Sunday off) and % = present ÷ (present + absent).
 */

/**
 * Attendance marks that count, for the students in $1, from `from` to `to` (SQL date expressions):
 * on a counted day (in a term, between joining and dropping, the degree's calendar, else ALL's, else
 * Sunday off). The same rules as the roster.
 */
const countedMarks = (from: string, to: string) => `
  SELECT a.niat_id, a.date, a.status
  FROM attendance.attendance a
  JOIN attendance.students s ON s.niat_id = a.niat_id
  LEFT JOIN attendance.calendar_days cd ON cd.date = a.date AND cd.applies_to = s.degree_code
  LEFT JOIN attendance.calendar_days ca ON ca.date = a.date AND ca.applies_to = 'ALL'
  WHERE a.niat_id = ANY($1::text[])
    AND a.date <= ${to}
    AND a.date >= ${from}
    AND (s.joined_on IS NULL OR a.date >= s.joined_on)
    AND (s.dropped_on IS NULL OR a.date <= s.dropped_on)
    AND EXISTS (SELECT 1 FROM attendance.terms t WHERE a.date BETWEEN t.start_date AND t.end_date)
    AND CASE
          WHEN cd.day_type IS NOT NULL THEN cd.day_type = 'working' OR (cd.day_type = 'event' AND cd.counts)
          WHEN ca.day_type IS NOT NULL THEN ca.day_type = 'working' OR (ca.day_type = 'event' AND ca.counts)
          ELSE extract(isodow FROM a.date) <> 7
        END`;

const ATTENDANCE_SQL = `
WITH d AS (SELECT $2::date AS day),
term AS (
  SELECT name, start_date FROM attendance.terms
  WHERE (SELECT day FROM d) BETWEEN start_date AND end_date
  ORDER BY is_current DESC, start_date DESC LIMIT 1
),
marks AS (${countedMarks("LEAST((SELECT day FROM d) - 6, COALESCE((SELECT start_date FROM term), (SELECT day FROM d) - 6))", "(SELECT day FROM d)")}
)
SELECT m.niat_id,
       count(*) FILTER (WHERE m.status = 'P' AND m.date >= (SELECT day FROM d) - 6)::int AS pweek,
       count(*) FILTER (WHERE m.date >= (SELECT day FROM d) - 6)::int AS cweek,
       count(*) FILTER (WHERE m.status = 'P' AND m.date >= (SELECT start_date FROM term))::int AS psem,
       count(*) FILTER (WHERE m.date >= (SELECT start_date FROM term))::int AS csem,
       (SELECT name FROM term) AS term
FROM marks m GROUP BY m.niat_id`;

const att = (present: number, counted: number): Attendance => ({ present, counted, pct: counted ? Math.round((present * 100) / counted) : null });

const stepCode = (step: string | null | undefined) => step?.match(/^\d\.\d/)?.[0] ?? null;

/** Where `s` is on the roadmap, and roughly how far through their level. */
export function progressOf(structure: Structure, s: Pick<RosterStudent, "level" | "topic" | "subtopic" | "step">): RoadmapProgress {
  const level = structure.levels.find((l) => l.level === s.level);
  // An archived topic stays in the list while the student is still on it.
  const topics = (level?.topics ?? []).filter((t) => !t.archived || t.name === s.topic).map((t) => t.name);
  const index = s.topic ? topics.indexOf(s.topic) : -1;
  let within = 0;
  if (s.level > 0) {
    const steps = studentSteps(structure, s.level, s.topic);
    const code = stepCode(s.step);
    const at = steps.findIndex((o) => o === s.step || (code !== null && stepCode(o) === code));
    if (steps.length && at >= 0) within = at / steps.length;
  } else {
    const subs = subtopicNames(structure, s.level, s.topic);
    const at = s.subtopic ? subs.indexOf(s.subtopic) : -1;
    if (subs.length && at >= 0) within = at / subs.length;
  }
  const code = s.level > 0 ? stepCode(s.step) : null;
  return {
    level: s.level,
    levelTitle: level?.title ?? "",
    topic: s.topic || null,
    subtopic: s.subtopic ?? null,
    topicNo: index >= 0 ? index + 1 : 0,
    topicCount: topics.length,
    step: code,
    stepLabel: code ? (structure.steps.find((x) => x.code === code)?.label ?? null) : null,
    percent: topics.length && index >= 0 ? Math.round(((index + within) / topics.length) * 100) : null,
  };
}

/** The test day, or today if the test hasn't happened yet (attendance can't count the future). */
export const asOfDay = (test: WeeklyTest) => (test.heldOn < todayIst() ? test.heldOn : todayIst());

/** The three filled-in values for each of `students` for `test`. */
export async function autofill(test: WeeklyTest, students: RosterStudent[]): Promise<Map<string, AutoFill>> {
  const asOf = asOfDay(test);
  const structure = await getStructure();
  const out = new Map<string, AutoFill>();
  if (!students.length) return out;

  if (authMode() !== "database") {
    // Sample data: the roster's own figures (no day counts).
    for (const s of students) {
      out.set(s.niatId, {
        semester: { present: 0, counted: 0, pct: s.attendanceTerm },
        week: { present: 0, counted: 0, pct: s.attendance30d },
        progress: progressOf(structure, s),
        asOf,
        semesterName: null,
      });
    }
    return out;
  }

  const { rows } = await getDb().query<{ niat_id: string; pweek: number; cweek: number; psem: number; csem: number; term: string | null }>(ATTENDANCE_SQL, [
    students.map((s) => s.niatId),
    asOf,
  ]);
  const byId = new Map(rows.map((r) => [r.niat_id, r]));
  const termName = rows.find((r) => r.term)?.term ?? null;
  for (const s of students) {
    const r = byId.get(s.niatId);
    out.set(s.niatId, {
      semester: att(r?.psem ?? 0, r?.csem ?? 0),
      week: att(r?.pweek ?? 0, r?.cweek ?? 0),
      progress: progressOf(structure, s),
      asOf,
      semesterName: termName,
    });
  }
  return out;
}

/** The week the "last week" figure covers, e.g. 15–21 Nov. */
export const weekRange = (asOf: string) => ({ from: addDays(asOf, -6), to: asOf });

/**
 * The filled-in values for each of `students` (same order as `results`): the snapshot saved with the
 * result when it's final (saved on or after the test day), otherwise worked out now. A snapshot saved
 * before the test day only counted attendance up to that save, so it's replaced until the result is
 * saved again.
 */
export async function autofillFor(test: WeeklyTest, students: RosterStudent[], results: ({ auto?: AutoFill | null } | null)[]): Promise<(AutoFill | null)[]> {
  const day = asOfDay(test);
  const fresh = (i: number) => {
    const a = results[i]?.auto;
    return a && a.asOf >= day ? a : null;
  };
  const live = await autofill(test, students.filter((_, i) => !fresh(i)));
  return students.map((s, i) => fresh(i) ?? live.get(s.niatId) ?? null);
}

export type WeekDay = { date: string; status: "P" | "A" | null };

/** Each of the 7 days up to the test day, per student: P or A on a counted day, null otherwise. */
export async function weekDays(test: WeeklyTest, niatIds: string[]): Promise<Map<string, WeekDay[]>> {
  const asOf = asOfDay(test);
  const days = Array.from({ length: 7 }, (_, i) => addDays(asOf, i - 6));
  const out = new Map<string, WeekDay[]>();
  const marks = new Map<string, "P" | "A">();
  if (niatIds.length && authMode() === "database") {
    const { rows } = await getDb().query<{ niat_id: string; date: string; status: string }>(
      `SELECT niat_id, date::text AS date, status FROM (${countedMarks("$2::date - 6", "$2::date")}) m`,
      [niatIds, asOf],
    );
    for (const r of rows) marks.set(`${r.niat_id}|${r.date}`, r.status === "P" ? "P" : "A");
  }
  for (const id of niatIds) out.set(id, days.map((date) => ({ date, status: marks.get(`${id}|${date}`) ?? null })));
  return out;
}
