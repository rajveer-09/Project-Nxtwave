/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import { getDb } from "@/common/db/pool";

/**
 * Contest performance read straight from the contest schema (web_svc reads it), for the Contests
 * page's "My students" and "By college" views. A student took part when their result is solved or
 * zero; students without a usable handle (no_handle, invalid_handle, duplicate_handle) are left out
 * of the rate, as in Analytics. Colleges come from the hub roster (core.students.college).
 */

const TOOK_PART = "r.status IN ('solved', 'zero')";
const HAS_HANDLE = "r.status NOT IN ('no_handle', 'invalid_handle', 'duplicate_handle')";
const SCANNED = "EXISTS (SELECT 1 FROM contest.results x WHERE x.contest_slug = c.slug)";

export type ContestRow = { slug: string; title: string; day: string; handles: number; tookPart: number; avgSolved: number | null; solvedAll: number; bestRank: number | null };

/** The latest scanned contests, for some students (null = everyone). */
export async function contestPerformance(niatIds: string[] | null, limit = 10): Promise<ContestRow[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(TAGS.roster, "contests");
  const { rows } = await getDb().query<{ slug: string; title: string; day: string; handles: number; took: number; avg: number | null; all4: number; best: number | null }>(
    `WITH recent AS (SELECT slug, title, start_time FROM contest.contests c WHERE ${SCANNED} ORDER BY start_time DESC LIMIT $2)
     SELECT c.slug, c.title, (to_timestamp(c.start_time) AT TIME ZONE 'Asia/Kolkata')::date::text AS day,
            count(*) FILTER (WHERE ${HAS_HANDLE})::int AS handles,
            count(*) FILTER (WHERE ${TOOK_PART})::int AS took,
            round(avg(r.solved_count) FILTER (WHERE ${TOOK_PART}), 2)::float AS avg,
            count(*) FILTER (WHERE r.solved_count >= 4)::int AS all4,
            min(r.global_rank) FILTER (WHERE ${TOOK_PART} AND r.global_rank > 0) AS best
     FROM recent c
     JOIN contest.results r ON r.contest_slug = c.slug
     JOIN contest.students s ON s.id = r.student_id
     WHERE $1::text[] IS NULL OR upper(s.roll_no) = ANY($1::text[])
     GROUP BY c.slug, c.title, c.start_time
     ORDER BY c.start_time DESC`,
    [niatIds, limit],
  );
  return rows.map((r) => ({ slug: r.slug, title: r.title, day: r.day, handles: r.handles, tookPart: r.took, avgSolved: r.avg, solvedAll: r.all4, bestRank: r.best }));
}

export type CollegeRow = {
  college: string;
  students: number;
  withHandle: number;
  participation: number | null;
  avgSolved: number | null;
  solvedAll: number;
  bestRank: number | null;
  /** Participation % per contest, oldest first (same contests for every college). */
  trend: { slug: string; title: string; pct: number | null }[];
};

/** Every NxtWave student, per college, over the latest scanned contests. */
export async function collegePerformance(limit = 8): Promise<{ contests: { slug: string; title: string; day: string }[]; colleges: CollegeRow[] }> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(TAGS.roster, "contests");
  const db = getDb();
  const [contests, perContest, roster] = await Promise.all([
    db.query<{ slug: string; title: string; day: string }>(
      `SELECT slug, title, (to_timestamp(start_time) AT TIME ZONE 'Asia/Kolkata')::date::text AS day
       FROM contest.contests c WHERE ${SCANNED} ORDER BY start_time DESC LIMIT $1`,
      [limit],
    ),
    db.query<{ college: string; slug: string; handles: number; took: number; solved_sum: number; all4: number; best: number | null }>(
      `WITH recent AS (SELECT slug FROM contest.contests c WHERE ${SCANNED} ORDER BY start_time DESC LIMIT $1)
       SELECT cs.college, r.contest_slug AS slug,
              count(*) FILTER (WHERE ${HAS_HANDLE})::int AS handles,
              count(*) FILTER (WHERE ${TOOK_PART})::int AS took,
              coalesce(sum(r.solved_count) FILTER (WHERE ${TOOK_PART}), 0)::int AS solved_sum,
              count(*) FILTER (WHERE r.solved_count >= 4)::int AS all4,
              min(r.global_rank) FILTER (WHERE ${TOOK_PART} AND r.global_rank > 0) AS best
       FROM contest.results r
       JOIN recent ON recent.slug = r.contest_slug
       JOIN contest.students s ON s.id = r.student_id
       JOIN core.students cs ON cs.niat_id = upper(s.roll_no) AND cs.status = 'active'
       GROUP BY cs.college, r.contest_slug`,
      [limit],
    ),
    db.query<{ college: string; students: number; with_handle: number }>(
      `SELECT cs.college, count(*)::int AS students,
              count(*) FILTER (WHERE s.handle_status = 'valid')::int AS with_handle
       FROM core.students cs LEFT JOIN contest.students s ON upper(s.roll_no) = cs.niat_id
       WHERE cs.status = 'active' GROUP BY cs.college ORDER BY cs.college`,
    ),
  ]);
  const ordered = [...contests.rows].reverse();
  const colleges = roster.rows.map((c) => {
    const rows = perContest.rows.filter((r) => r.college === c.college);
    const handles = rows.reduce((n, r) => n + r.handles, 0);
    const took = rows.reduce((n, r) => n + r.took, 0);
    const solved = rows.reduce((n, r) => n + r.solved_sum, 0);
    const ranks = rows.map((r) => r.best).filter((v): v is number => v !== null);
    return {
      college: c.college,
      students: c.students,
      withHandle: c.with_handle,
      participation: handles ? Math.round((took * 1000) / handles) / 10 : null,
      avgSolved: took ? Math.round((solved * 100) / took) / 100 : null,
      solvedAll: rows.reduce((n, r) => n + r.all4, 0),
      bestRank: ranks.length ? Math.min(...ranks) : null,
      trend: ordered.map((ct) => {
        const r = rows.find((x) => x.slug === ct.slug);
        return { slug: ct.slug, title: ct.title, pct: r && r.handles ? Math.round((r.took * 100) / r.handles) : null };
      }),
    };
  });
  return { contests: ordered, colleges };
}
