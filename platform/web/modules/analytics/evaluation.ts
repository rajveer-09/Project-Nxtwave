/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import { getDb } from "@/common/db/pool";

/**
 * DSA evaluation analytics (the numbers the Instructor Evaluation dashboard showed), read straight
 * from the logs schema. Outcomes are stored as 'Cleared', 'Need to Revisit' and 'In Progress'.
 */

// ---------------------------------------------------------------- level conversions

/**
 * When a level conversion counts (decided 13 Oct 2026, kept from the Instructor Evaluation app).
 *  - A student who first moved past Level N from STRICT_RULE_FROM counts for N→N+1 once every required
 *    topic of Level N (core.curriculum_topics.required) has its own Cleared interaction logged at
 *    Level N; a topic with subtopics needs each subtopic cleared. Dated by whichever was cleared last
 *    (each one's first Cleared date, any order). Until then it is listed as not counted.
 *  - Conversions from before STRICT_RULE_FROM count as they always did, dated by the latest interaction
 *    at the old level before the promotion (or the day of the change).
 *  - Only students still above Level N count (an undone promotion counts nothing). A jump N→M counts
 *    every boundary in between.
 * Topic names are compared loosely (case, spaces, punctuation and a trailing "s" ignored), because
 * older interactions were typed by hand.
 */
export const STRICT_RULE_FROM = "2026-10-13T16:00:00+05:30";

const key = (expr: string) => `regexp_replace(regexp_replace(lower(${expr}), '[^a-z0-9&]', '', 'g'), 's$', '')`;

const CONVERSIONS_SQL = `
WITH required AS (
  SELECT t.level AS lvl, ${key("t.name")} AS topic, ${key("st.name")} AS sub
  FROM core.curriculum_topics t
  LEFT JOIN core.curriculum_subtopics st ON st.topic_id = t.id AND NOT st.archived
  WHERE t.required AND NOT t.archived
), first_cleared_sub AS (
  SELECT it.student_id, COALESCE(it.level, 0) AS lvl, ${key("t")} AS topic, ${key("st")} AS sub, min(it.date) AS cleared_on
  FROM logs.interactions it
  CROSS JOIN LATERAL unnest(string_to_array(it.topics, ',')) AS t
  CROSS JOIN LATERAL unnest(string_to_array(it.subtopics, ',')) AS st
  WHERE it.status_post_interaction = 'Cleared' AND it.subtopics <> ''
  GROUP BY 1, 2, 3, 4
), first_cleared AS (
  SELECT it.student_id, COALESCE(it.level, 0) AS lvl, ${key("t")} AS topic, min(it.date) AS cleared_on
  FROM logs.interactions it CROSS JOIN LATERAL unnest(string_to_array(it.topics, ',')) AS t
  WHERE it.status_post_interaction = 'Cleared'
  GROUP BY 1, 2, 3
), ups AS (
  SELECT lc.id, lc.student_id, lc.changed_at, lc.source, b AS boundary,
         CASE WHEN lc.source = 'backfill' THEN lc.change_date ELSE COALESCE((
           SELECT max(it.date) FROM logs.interactions it
           WHERE it.student_id = lc.student_id AND COALESCE(it.level, 0) = lc.from_level AND it.created_at <= lc.changed_at
         ), lc.change_date) END AS fallback_on
  FROM logs.level_changes lc
  CROSS JOIN LATERAL generate_series(lc.from_level, lc.to_level - 1) AS b
  WHERE lc.to_level > lc.from_level
), latest AS (
  SELECT DISTINCT ON (u.student_id, u.boundary) u.*,
         min(u.changed_at) OVER (PARTITION BY u.student_id, u.boundary) AS first_crossed_at
  FROM ups u ORDER BY u.student_id, u.boundary, u.changed_at DESC, u.id DESC
), strict AS (
  SELECT l.student_id, l.boundary,
         CASE WHEN bool_and(COALESCE(fc.cleared_on, fs.cleared_on) IS NOT NULL)
              THEN max(COALESCE(fc.cleared_on, fs.cleared_on)) END AS completed_on
  FROM latest l
  JOIN required r ON r.lvl = l.boundary
  LEFT JOIN first_cleared fc ON r.sub IS NULL AND fc.student_id = l.student_id AND fc.lvl = r.lvl AND fc.topic = r.topic
  LEFT JOIN first_cleared_sub fs ON r.sub IS NOT NULL AND fs.student_id = l.student_id AND fs.lvl = r.lvl
    AND fs.topic = r.topic AND fs.sub = r.sub
  GROUP BY l.student_id, l.boundary
), dated AS (
  SELECT l.*,
         CASE WHEN l.first_crossed_at < $1::timestamptz THEN l.fallback_on ELSE st.completed_on END AS on_date,
         l.first_crossed_at >= $1::timestamptz AND st.completed_on IS NULL AS incomplete
  FROM latest l LEFT JOIN strict st USING (student_id, boundary)
)
SELECT upper(d.student_id) AS niat_id, d.boundary AS from_level,
       to_char(COALESCE(d.on_date, d.fallback_on), 'YYYY-MM-DD') AS date,
       d.incomplete, d.source = 'backfill' AS estimated
FROM dated d
JOIN logs.students s ON s.id = d.student_id
WHERE s.level > d.boundary
ORDER BY 3 DESC, 2, 1`;

/** One student crossing Level `from` → `from + 1`. `counted` false: moved up before clearing every topic. */
export type Conversion = { niatId: string; from: number; date: string; counted: boolean; estimated: boolean };

export async function getConversions(): Promise<Conversion[]> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  cacheTag(TAGS.interactions, TAGS.roster, TAGS.curriculum);
  const { rows } = await getDb().query<{ niat_id: string; from_level: number; date: string; incomplete: boolean; estimated: boolean }>(CONVERSIONS_SQL, [
    STRICT_RULE_FROM,
  ]);
  return rows.map((r) => ({ niatId: r.niat_id, from: r.from_level, date: r.date, counted: !r.incomplete, estimated: r.estimated }));
}

// ---------------------------------------------------------------- interactions

export type OutcomeCounts = { students: number; cleared: number; revisit: number; inProgress: number };
export type Evaluation = {
  /** Today: interactions taken, and students whose outcome today was Cleared / Need to Revisit. */
  today: { interactions: number; cleared: number; revisit: number };
  /** Per day and college: students seen that day, by their latest outcome that day. */
  daily: ({ day: string; college: string } & OutcomeCounts)[];
  /** Per college: interactions in the dates and today, students with a Cleared / Revisit outcome in the dates. */
  colleges: { college: string; interactions: number; today: number; cleared: number; revisit: number }[];
  /** Per instructor who took interactions: today, last 3 and 7 days (today included), in the dates, and all-time outcomes. */
  instructors: { name: string; today: number; last3: number; last7: number; inRange: number; cleared: number; revisits: number }[];
  /** Per student, all time. */
  students: { niatId: string; interactions: number; cleared: number; revisits: number; last: string | null }[];
};

/**
 * Interaction numbers for the chosen dates. `ids` limits every number to those students (an
 * instructor's or coach's own); null is the whole cohort. Shared by everyone with the same view.
 */
export async function getEvaluation(from: string, to: string, today: string, ids: string[] | null = null): Promise<Evaluation> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  cacheTag(TAGS.interactions, TAGS.roster);
  const db = getDb();
  // Interactions of the students in view (parameter `p` null: everyone)
  const its = (p: number) => `(SELECT * FROM logs.interactions WHERE $${p}::text[] IS NULL OR upper(student_id) = ANY($${p}::text[]))`;
  const [todayRow, daily, colleges, instructors, students] = await Promise.all([
    db.query<{ n: number; cleared: number; revisit: number }>(
      `WITH latest AS (
         SELECT DISTINCT ON (upper(it.student_id)) it.status_post_interaction AS outcome
         FROM ${its(2)} it WHERE it.date = $1::date
         ORDER BY upper(it.student_id), it.created_at DESC
       )
       SELECT (SELECT count(*) FROM ${its(2)} it WHERE it.date = $1::date)::int AS n,
              count(*) FILTER (WHERE outcome = 'Cleared')::int AS cleared,
              count(*) FILTER (WHERE outcome = 'Need to Revisit')::int AS revisit
       FROM latest`,
      [today, ids],
    ),
    db.query<{ day: string; college: string; students: number; cleared: number; revisit: number; in_progress: number }>(
      `WITH latest AS (
         SELECT DISTINCT ON (it.date, upper(it.student_id)) it.date, upper(it.student_id) AS niat_id, it.status_post_interaction AS outcome
         FROM ${its(3)} it
         WHERE it.date BETWEEN $1::date AND $2::date
         ORDER BY it.date, upper(it.student_id), it.created_at DESC
       )
       SELECT l.date::text AS day, s.college, count(*)::int AS students,
              count(*) FILTER (WHERE l.outcome = 'Cleared')::int AS cleared,
              count(*) FILTER (WHERE l.outcome = 'Need to Revisit')::int AS revisit,
              count(*) FILTER (WHERE l.outcome NOT IN ('Cleared', 'Need to Revisit'))::int AS in_progress
       FROM latest l JOIN core.students s ON s.niat_id = l.niat_id
       GROUP BY 1, 2`,
      [from, to, ids],
    ),
    db.query<{ college: string; interactions: number; today: number; cleared: number; revisit: number }>(
      `SELECT s.college,
              count(*) FILTER (WHERE it.date BETWEEN $1::date AND $2::date)::int AS interactions,
              count(*) FILTER (WHERE it.date = $3::date)::int AS today,
              count(DISTINCT s.niat_id) FILTER (WHERE it.date BETWEEN $1::date AND $2::date AND it.status_post_interaction = 'Cleared')::int AS cleared,
              count(DISTINCT s.niat_id) FILTER (WHERE it.date BETWEEN $1::date AND $2::date AND it.status_post_interaction = 'Need to Revisit')::int AS revisit
       FROM ${its(4)} it JOIN core.students s ON s.niat_id = upper(it.student_id)
       WHERE it.date BETWEEN $1::date AND $2::date OR it.date = $3::date
       GROUP BY 1`,
      [from, to, today, ids],
    ),
    // Everyone still teaching, plus anyone who has left but took interactions; with ids, only
    // instructors who took interactions with those students.
    db.query<{ name: string; today: number; last3: number; last7: number; in_range: number; cleared: number; revisits: number }>(
      `SELECT COALESCE(i.full_name, x.instructor_name) AS name,
              count(x.id) FILTER (WHERE x.date = $3::date)::int AS today,
              count(x.id) FILTER (WHERE x.date BETWEEN $3::date - 2 AND $3::date)::int AS last3,
              count(x.id) FILTER (WHERE x.date BETWEEN $3::date - 6 AND $3::date)::int AS last7,
              count(x.id) FILTER (WHERE x.date BETWEEN $1::date AND $2::date)::int AS in_range,
              count(x.id) FILTER (WHERE x.status_post_interaction = 'Cleared')::int AS cleared,
              count(x.id) FILTER (WHERE x.status_post_interaction = 'Need to Revisit')::int AS revisits
       FROM logs.instructors i
       FULL JOIN ${its(4)} x ON x.taken_by_instructor_id = i.id
       WHERE (i.left_on IS NULL OR x.id IS NOT NULL) AND COALESCE(i.full_name, x.instructor_name) IS NOT NULL
       GROUP BY 1
       HAVING $4::text[] IS NULL OR count(x.id) > 0
       ORDER BY 1`,
      [from, to, today, ids],
    ),
    db.query<{ niat_id: string; n: number; cleared: number; revisits: number; last: string | null }>(
      `SELECT upper(student_id) AS niat_id, count(*)::int AS n,
              count(*) FILTER (WHERE status_post_interaction = 'Cleared')::int AS cleared,
              count(*) FILTER (WHERE status_post_interaction = 'Need to Revisit')::int AS revisits,
              max(date)::text AS last
       FROM logs.interactions
       WHERE $1::text[] IS NULL OR upper(student_id) = ANY($1::text[])
       GROUP BY 1`,
      [ids],
    ),
  ]);
  const t = todayRow.rows[0];
  return {
    today: { interactions: t?.n ?? 0, cleared: t?.cleared ?? 0, revisit: t?.revisit ?? 0 },
    daily: daily.rows.map((r) => ({ day: r.day, college: r.college, students: r.students, cleared: r.cleared, revisit: r.revisit, inProgress: r.in_progress })),
    colleges: colleges.rows,
    instructors: instructors.rows.map((r) => ({ name: r.name, today: r.today, last3: r.last3, last7: r.last7, inRange: r.in_range, cleared: r.cleared, revisits: r.revisits })),
    students: students.rows.map((r) => ({ niatId: r.niat_id, interactions: r.n, cleared: r.cleared, revisits: r.revisits, last: r.last })),
  };
}
