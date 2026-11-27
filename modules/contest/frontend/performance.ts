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

export type TopKRank = {
  niatId: string;
  name: string;
  /** Scanned contests among the latest `limit`, and how many they took part in. */
  scanned: number;
  tookPart: number;
  solved: number;
  avgSolved: number | null;
  bestRank: number | null;
  last: { title: string; status: string; solved: number | null } | null;
};

/**
 * Top K students ranked among themselves over the latest scanned contests: by total problems solved
 * (so taking part regularly counts, not one good contest), then how often they took part, then
 * their best global rank.
 */
export async function topKRanking(niatIds: string[], limit = 10): Promise<TopKRank[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(TAGS.roster, "contests");
  if (!niatIds.length) return [];
  const { rows } = await getDb().query<{ niat: string; name: string; scanned: number; took: number; solved: number; avg: number | null; best: number | null; last_title: string | null; last_status: string | null; last_solved: number | null }>(
    `WITH recent AS (SELECT slug, title, start_time FROM contest.contests c WHERE ${SCANNED} ORDER BY start_time DESC LIMIT $2),
     per AS (
       SELECT upper(trim(s.roll_no)) AS niat, s.name, c.title, c.start_time, r.status, r.solved_count, r.global_rank
       FROM recent c JOIN contest.results r ON r.contest_slug = c.slug JOIN contest.students s ON s.id = r.student_id
       WHERE upper(trim(s.roll_no)) = ANY($1::text[])
     )
     SELECT niat, max(name) AS name, count(*)::int AS scanned,
            count(*) FILTER (WHERE status IN ('solved', 'zero'))::int AS took,
            COALESCE(sum(solved_count) FILTER (WHERE status IN ('solved', 'zero')), 0)::int AS solved,
            round(avg(solved_count) FILTER (WHERE status IN ('solved', 'zero')), 2)::float AS avg,
            min(global_rank) FILTER (WHERE status IN ('solved', 'zero') AND global_rank > 0) AS best,
            (array_agg(title ORDER BY start_time DESC))[1] AS last_title,
            (array_agg(status ORDER BY start_time DESC))[1] AS last_status,
            (array_agg(solved_count ORDER BY start_time DESC))[1] AS last_solved
     FROM per GROUP BY niat`,
    [niatIds, limit],
  );
  return rows
    .map((r) => ({
      niatId: r.niat,
      name: r.name,
      scanned: r.scanned,
      tookPart: r.took,
      solved: r.solved,
      avgSolved: r.avg,
      bestRank: r.best,
      last: r.last_title ? { title: r.last_title, status: r.last_status ?? "", solved: r.last_status === "solved" || r.last_status === "zero" ? r.last_solved : null } : null,
    }))
    .sort((a, b) => b.solved - a.solved || b.tookPart - a.tookPart || (a.bestRank ?? Infinity) - (b.bestRank ?? Infinity));
}

/** The latest scanned contests' best three among these students (by solved, then global rank). */
export async function topThreeByContest(niatIds: string[], limit = 10): Promise<Record<string, { niatId: string; name: string; solved: number; rank: number | null }[]>> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(TAGS.roster, "contests");
  if (!niatIds.length) return {};
  const { rows } = await getDb().query<{ slug: string; niat: string; name: string; solved: number; rank: number | null }>(
    `WITH recent AS (SELECT slug FROM contest.contests c WHERE ${SCANNED} ORDER BY start_time DESC LIMIT $2),
     took AS (
       SELECT r.contest_slug AS slug, upper(trim(s.roll_no)) AS niat, s.name, r.solved_count AS solved, NULLIF(r.global_rank, 0) AS rank,
              row_number() OVER (PARTITION BY r.contest_slug ORDER BY r.solved_count DESC, r.global_rank ASC NULLS LAST) AS n
       FROM recent c JOIN contest.results r ON r.contest_slug = c.slug JOIN contest.students s ON s.id = r.student_id
       WHERE upper(trim(s.roll_no)) = ANY($1::text[]) AND r.status IN ('solved', 'zero')
     )
     SELECT slug, niat, name, solved, rank FROM took WHERE n <= 3 ORDER BY slug, n`,
    [niatIds, limit],
  );
  const out: Record<string, { niatId: string; name: string; solved: number; rank: number | null }[]> = {};
  for (const r of rows) (out[r.slug] ??= []).push({ niatId: r.niat, name: r.name, solved: r.solved, rank: r.rank });
  return out;
}
