/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import type { ContestDetail, ContestListItem, ContestPage, ContestResults, DraftReview, QuestionStat, QuestionTopics, ResultRow, StudentAnalytics, Summary, TopicsData, ContestStudent } from "@nxtone/contest-ui/types";
import { toCsv } from "@/common/lib/csv";
import { searchMatcher } from "@/common/lib/search";
import { buildStudentDetail } from "@/common/sample-data/student-detail";
import { ROSTER } from "@/common/sample-data/roster";

/**
 * Sample contest service: the routes and JSON of NxtRank's API
 * (backend/app/api/routes_data.py, routes_admin.py), backed by memory. Used only
 * in development when CONTEST_API_ORIGIN isn't set. Problem titles are
 * placeholders, not real LeetCode problems.
 */

type ContestDef = { slug: string; title: string; type: "weekly" | "biweekly"; startIst: string; worldwide: number | null };

const CONTESTS: ContestDef[] = [
  { slug: "biweekly-contest-171", title: "Biweekly Contest 171", type: "biweekly", startIst: "2026-11-28T20:00", worldwide: null },
  { slug: "weekly-contest-477", title: "Weekly Contest 477", type: "weekly", startIst: "2026-11-22T08:00", worldwide: null },
  { slug: "weekly-contest-476", title: "Weekly Contest 476", type: "weekly", startIst: "2026-11-15T08:00", worldwide: 31240 },
  { slug: "biweekly-contest-170", title: "Biweekly Contest 170", type: "biweekly", startIst: "2026-11-14T20:00", worldwide: 24410 },
  { slug: "weekly-contest-475", title: "Weekly Contest 475", type: "weekly", startIst: "2026-11-08T08:00", worldwide: 30115 },
  { slug: "weekly-contest-474", title: "Weekly Contest 474", type: "weekly", startIst: "2026-11-01T08:00", worldwide: 29870 },
  { slug: "biweekly-contest-169", title: "Biweekly Contest 169", type: "biweekly", startIst: "2026-10-31T20:00", worldwide: 23980 },
  { slug: "weekly-contest-473", title: "Weekly Contest 473", type: "weekly", startIst: "2026-10-25T08:00", worldwide: 29500 },
  { slug: "weekly-contest-472", title: "Weekly Contest 472", type: "weekly", startIst: "2026-10-18T08:00", worldwide: 30410 },
];
const LABELS = ["Q1", "Q2", "Q3", "Q4"];
const CREDITS = [3, 4, 5, 6];

const epoch = (ist: string) => Math.floor(new Date(`${ist}:00+05:30`).getTime() / 1000);

type State = { finalized: Set<string>; review: Map<string, DraftReview>; scans: { slug: string; requestedBy: string; at: number }[] };
const g = globalThis as unknown as { __contestState?: State };
function state(): State {
  if (!g.__contestState) {
    g.__contestState = {
      // Weekly 476 has early results until its final scan; Biweekly 170 has a manual scan waiting for review.
      scans: [],
      finalized: new Set(["weekly-contest-475", "weekly-contest-474", "biweekly-contest-169", "weekly-contest-473", "weekly-contest-472"]),
      review: new Map([
        [
          "biweekly-contest-170",
          { run_id: 42, contest_slug: "biweekly-contest-170", title: "Biweekly Contest 170", kind: "final", finished_at: "2026-11-17T09:40:00+05:30", outdated: false, students: ROSTER.length, solved_any: 0, participated: 0, participated_before: null, joined: 3, left: 1, changed: 6 },
        ],
      ]),
    };
  }
  return g.__contestState;
}

/** Sample scans take this long each, one after another (the real ones take minutes). */
const SAMPLE_SCAN_MS = 40_000;
const SAMPLE_PAGES = 760;

/**
 * Requested scans: the first runs, the rest wait. A finished scan's results wait for review,
 * like a real manual scan. Worked out on each request from the time it was asked for.
 */
function scanQueue(now = Date.now()) {
  const st = state();
  let start = st.scans[0]?.at ?? now;
  while (st.scans.length && now - start >= SAMPLE_SCAN_MS) {
    const done = st.scans.shift()!;
    const def = CONTESTS.find((x) => x.slug === done.slug)!;
    const s = summarise(resultsFor(def));
    st.review.set(def.slug, {
      run_id: 100 + st.review.size + st.finalized.size,
      contest_slug: def.slug,
      title: def.title,
      kind: "final",
      finished_at: new Date(start + SAMPLE_SCAN_MS).toISOString(),
      outdated: false,
      students: s.students,
      solved_any: s.solved_any,
      participated: s.participated,
      participated_before: s.participated,
      joined: 0,
      left: 0,
      changed: 0,
    });
    start = Math.max(start + SAMPLE_SCAN_MS, st.scans[0]?.at ?? now);
    // The next one started when this one finished (or when it was asked for, if later).
    if (st.scans[0]) st.scans[0].at = start;
  }
  const iso = (ms: number) => new Date(ms).toISOString();
  const head = st.scans[0];
  const progress = head ? Math.min(0.99, (now - start) / SAMPLE_SCAN_MS) : 0;
  const running = head
    ? {
        slug: head.slug,
        kind: "final",
        progress: Math.round(progress * 1000) / 1000,
        pages_done: Math.round(progress * SAMPLE_PAGES),
        pages_total: SAMPLE_PAGES,
        started_at: iso(start),
        ready_at: iso(start + SAMPLE_SCAN_MS),
        requested_by: head.requestedBy,
        cancel_requested: false,
      }
    : null;
  const queue = st.scans.slice(1).map((q, i) => ({ slug: q.slug, kind: "auto", position: i + 1, requested_by: q.requestedBy, ready_at: iso(start + SAMPLE_SCAN_MS * (i + 2)) }));
  return { worker: { alive: true, last_seen: iso(now - 20_000) }, running, queue, typical_scan_secs: SAMPLE_SCAN_MS / 1000 };
}

/** A contest's scan fields while it's being scanned or waiting (empty otherwise). */
function scanFields(slug: string): Partial<ContestListItem> {
  const q = scanQueue();
  if (q.running?.slug === slug) return { state: "scanning", progress: q.running.progress, ready_at: q.running.ready_at, requested_by: q.running.requested_by };
  const queued = q.queue.find((x) => x.slug === slug);
  return queued ? { state: "queued", position: queued.position, ready_at: queued.ready_at, requested_by: queued.requested_by } : {};
}

function hash(text: string) {
  return [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17);
}

/** Every roster student's row for one contest, ranked within the college. */
function resultsFor(def: ContestDef): ResultRow[] {
  const rows: ResultRow[] = ROSTER.map((s, i) => {
    const detail = buildStudentDetail(s).contests;
    const entry = detail.results.find((r) => r.name === def.title);
    const base: ResultRow = {
      student_id: i + 1,
      roll_no: s.niatId,
      name: s.name,
      college: s.college,
      extra: { section: s.section, batch: "2024" },
      leetcode_handle: s.lcHandle ?? "",
      status: "absent",
      global_rank: null,
      ranking_url: null,
      college_rank: null,
      score: null,
      solved: null,
      total_time_secs: null,
      problems: {},
    };
    if (!s.lcHandle) return { ...base, status: "no_handle" };
    if (!entry?.attended) return base;
    const solved = entry.solved ?? 0;
    const problems: ResultRow["problems"] = {};
    let total = 0;
    for (let q = 0; q < solved; q++) {
      const secs = 300 + (hash(`${s.niatId}${def.slug}${q}`) % (900 * (q + 1)));
      total += secs;
      problems[LABELS[q]] = { solve_secs: secs, fail_count: hash(`${def.slug}${s.niatId}${q}`) % 3, lang: "cpp" };
    }
    return {
      ...base,
      status: solved ? "solved" : "zero",
      global_rank: entry.globalRank,
      ranking_url: `https://leetcode.com/contest/${def.slug}/ranking/`,
      score: CREDITS.slice(0, solved).reduce((a, b) => a + b, 0),
      solved,
      total_time_secs: solved ? total : null,
      problems,
    };
  });
  for (const college of ["BITS", "CDU"]) {
    rows
      .filter((r) => r.college === college && r.global_rank !== null)
      .sort((a, b) => (a.global_rank ?? 0) - (b.global_rank ?? 0))
      .forEach((r, i) => (r.college_rank = i + 1));
  }
  return rows.sort((a, b) => (a.college_rank ?? 1e9) - (b.college_rank ?? 1e9) || a.name.localeCompare(b.name));
}

function summarise(rows: ResultRow[]): Summary {
  const participated = rows.filter((r) => r.status === "solved" || r.status === "zero");
  const withHandle = rows.filter((r) => r.status !== "no_handle" && r.status !== "invalid_handle");
  const ranks = participated.map((r) => r.global_rank).filter((x): x is number => x !== null);
  return {
    students: rows.length,
    participated: participated.length,
    solved_any: rows.filter((r) => r.status === "solved").length,
    zero: rows.filter((r) => r.status === "zero").length,
    absent: rows.filter((r) => r.status === "absent").length,
    invalid_handle: rows.filter((r) => r.status === "invalid_handle").length,
    no_handle: rows.filter((r) => r.status === "no_handle").length,
    participation_rate: withHandle.length ? participated.length / withHandle.length : null,
    avg_solved: participated.length ? participated.reduce((n, r) => n + (r.solved ?? 0), 0) / participated.length : null,
    best_global_rank: ranks.length ? Math.min(...ranks) : null,
  };
}

/** roll_nos (NIAT IDs, comma-separated) as a set, or null when not given. */
function rollNos(url: URL) {
  const raw = url.searchParams.get("roll_nos");
  return raw === null ? null : new Set(raw.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean));
}

function scoped(rows: ResultRow[], url: URL, user: SessionUser) {
  const college = url.searchParams.get("college");
  const mine = url.searchParams.get("mine") === "true";
  const picked = rollNos(url);
  const myIds = new Set(ROSTER.filter((s) => s.instructor === user.name).map((s) => s.niatId));
  return rows.filter(
    (r) => (!college || r.college === college) && (!mine || myIds.has(r.roll_no ?? "")) && (!picked || picked.has((r.roll_no ?? "").toUpperCase())),
  );
}

/* ---------------------------------------------------------------- topics (services/topics.py) */

/** Each sample question's topics, by position (Q1–Q4). */
const SAMPLE_TAGS: [string, string][][] = [
  [["array", "Array"], ["hash-table", "Hash Table"]],
  [["string", "String"], ["greedy", "Greedy"]],
  [["dynamic-programming", "Dynamic Programming"], ["array", "Array"]],
  [["graph", "Graph"], ["binary-search", "Binary Search"]],
];

const questionTopics = (i: number): QuestionTopics => ({
  state: "official",
  tags: SAMPLE_TAGS[i].map(([slug, name]) => ({ slug, name, source: "official" as const })),
  mentions: null,
  fetched_at: "2026-11-20T10:00:00+05:30",
});

/** Topic metrics over the last `last` scanned contests, for the rows `keep` lets through. */
function topicsFor(last: number | null, keep: (r: ResultRow) => boolean, group: boolean): TopicsData {
  const nowSec = Math.floor(Date.now() / 1000);
  const scanned = CONTESTS.filter((d) => listItem(d, nowSec).has_data).slice(0, last ?? undefined);
  const acc = new Map<string, { name: string; appeared: number; solved: number; wrong: number; secs: number[] }>();
  for (const def of scanned) {
    const took = resultsFor(def).filter((r) => keep(r) && (r.status === "solved" || r.status === "zero"));
    LABELS.forEach((label, i) => {
      for (const [slug, name] of SAMPLE_TAGS[i]) {
        const t = acc.get(slug) ?? { name, appeared: 0, solved: 0, wrong: 0, secs: [] };
        for (const r of took) {
          t.appeared += 1;
          const p = r.problems[label];
          if (p) {
            t.solved += 1;
            t.wrong += p.fail_count;
            t.secs.push(p.solve_secs);
          }
        }
        acc.set(slug, t);
      }
    });
  }
  const topics = [...acc.entries()].map(([slug, t]) => {
    const sorted = [...t.secs].sort((a, b) => a - b);
    const m = {
      appeared: t.appeared,
      solved: t.solved,
      solve_rate: t.appeared ? Math.round((t.solved / t.appeared) * 10000) / 10000 : null,
      accuracy: t.solved ? Math.round((t.solved / (t.solved + t.wrong)) * 10000) / 10000 : null,
      median_secs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    };
    return { slug, name: t.name, ...m, official: m, provisional_appeared: 0, provisional_questions: 0 };
  });
  const weakest = topics
    .filter((t) => t.appeared >= 10 && t.solve_rate !== null)
    .sort((a, b) => (a.solve_rate ?? 0) - (b.solve_rate ?? 0))
    .slice(0, 3)
    .map((t) => t.slug);
  const coverage = { contests: scanned.length, contests_provisional: 0, questions: scanned.length * 4, official: scanned.length * 4, provisional: 0, insufficient: 0, pending: 0, last_refresh: "2026-11-20T10:00:00+05:30" };
  return group ? { topics, weakest, coverage } : { topics, coverage };
}

function statusOf(def: ContestDef, nowSec: number): ContestListItem["state"] {
  const start = epoch(def.startIst);
  if (start > nowSec) return "upcoming";
  if (nowSec < start + 90 * 60) return "live";
  return state().finalized.has(def.slug) ? "final" : "provisional";
}

function listItem(def: ContestDef, nowSec: number): ContestListItem {
  const st = statusOf(def, nowSec);
  const hasData = st === "provisional" || st === "final";
  const finalAt = new Date((epoch(def.startIst) + 7 * 86400) * 1000).toISOString();
  return {
    slug: def.slug,
    title: def.title,
    contest_type: def.type,
    start_time: epoch(def.startIst),
    duration: 5400,
    participants_worldwide: def.worldwide,
    state: st,
    has_data: hasData,
    in_review: state().review.has(def.slug),
    scanned_at: hasData ? new Date((epoch(def.startIst) + 7200) * 1000).toISOString() : null,
    final_at: st === "provisional" ? finalAt : null,
    summary: hasData ? summarise(resultsFor(def)) : null,
    ...scanFields(def.slug),
  };
}

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const detailError = (status: number, detail: string) => json(status, { detail });
const isAdmin = (u: SessionUser) => u.role === "owner" || u.role === "admin";

export async function contestSample(request: Request, path: string[], user: SessionUser): Promise<Response> {
  const url = new URL(request.url);
  const nowSec = Math.floor(Date.now() / 1000);
  const [a, b, c, d] = path;

  if (request.method === "GET" && a === "contests" && !b) {
    const type = url.searchParams.get("type");
    const match = searchMatcher(url.searchParams.get("q"));
    const all = CONTESTS.map((def) => listItem(def, nowSec));
    const upcoming = all.filter((x) => x.state === "upcoming" || x.state === "live").reverse();
    const items = all.filter((x) => x.state !== "upcoming" && x.state !== "live").filter((x) => (!type || x.contest_type === type) && match(x.title, x.slug));
    const body: ContestPage = {
      ...scanQueue(),
      upcoming,
      items,
      total: items.length,
      page: 1,
      per_page: 50,
      with_data: items.filter((x) => x.has_data).length,
      latest_slugs: ["weekly-contest-476", "biweekly-contest-170"],
    };
    return json(200, body);
  }

  const def = a === "contests" && b ? CONTESTS.find((x) => x.slug === b) : undefined;
  if (a === "contests" && b && !def) return detailError(404, "Contest not found");

  if (request.method === "GET" && def && !c) {
    const item = listItem(def, nowSec);
    const rows = item.has_data ? scoped(resultsFor(def), url, user) : [];
    const questions: QuestionStat[] = LABELS.map((label, i) => {
      const solvers = rows.filter((r) => r.problems[label]);
      const secs = solvers.map((r) => r.problems[label].solve_secs).sort((x, y) => x - y);
      const participated = rows.filter((r) => r.status === "solved" || r.status === "zero").length;
      return {
        label,
        question_id: 3000 + i,
        credit: CREDITS[i],
        title: `${label} · sample problem`,
        title_slug: `${def.slug}-q${i + 1}`,
        url: null,
        solved: solvers.length,
        solve_rate: participated ? solvers.length / participated : null,
        median_solve_secs: secs.length ? secs[Math.floor(secs.length / 2)] : null,
        avg_wrong: solvers.length ? solvers.reduce((n, r) => n + r.problems[label].fail_count, 0) / solvers.length : null,
        topics: questionTopics(i),
      };
    });
    const colleges = ["BITS", "CDU"].map((college) => {
      const cr = rows.filter((r) => r.college === college);
      const s = summarise(cr);
      const ranks = cr.map((r) => r.college_rank).filter((x): x is number => x !== null);
      return { college, students: s.students, participated: s.participated, participation_rate: s.participation_rate, avg_solved: s.avg_solved, solved_all: cr.filter((r) => r.solved === 4).length, best_global_rank: s.best_global_rank, best_college_rank: ranks.length ? Math.min(...ranks) : null };
    });
    const review = isAdmin(user) ? (state().review.get(def.slug) ?? null) : null;
    const body: ContestDetail = {
      review: review ? { ...review, participated: summarise(resultsFor(def)).participated, solved_any: summarise(resultsFor(def)).solved_any, participated_before: summarise(resultsFor(def)).participated - 2 } : null,
      slug: def.slug,
      title: def.title,
      contest_type: def.type,
      start_time: item.start_time,
      duration: item.duration,
      participants_worldwide: def.worldwide,
      leetcode_url: `https://leetcode.com/contest/${def.slug}/`,
      scan: item.has_data ? { kind: item.state === "final" ? "final" : "provisional", finished_at: item.scanned_at ?? null } : null,
      status: { state: item.state, has_data: item.has_data, in_review: item.in_review, final_at: item.final_at, progress: item.progress, position: item.position, ready_at: item.ready_at, requested_by: item.requested_by },
      summary: summarise(rows),
      questions,
      distributions: { colleges },
      final_scan_at: item.final_at ?? null,
      colleges: ["BITS", "CDU"],
    };
    return json(200, body);
  }

  if (request.method === "GET" && def && c === "results") {
    const body: ContestResults = { labels: LABELS, rows: listItem(def, nowSec).has_data ? scoped(resultsFor(def), url, user) : [] };
    return json(200, body);
  }

  if (request.method === "GET" && def && c === "export.csv") {
    const rows = scoped(resultsFor(def), url, user);
    const csv = toCsv(
      ["College rank", "Roll no", "Name", "College", "Section", "Handle", "Status", "Solved", "Score", "Global rank"],
      rows.map((r) => [r.college_rank, r.roll_no, r.name, r.college, r.extra.section, r.leetcode_handle, r.status, r.solved, r.score, r.global_rank]),
    );
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${def.slug}.csv"` } });
  }

  if (request.method === "POST" && a === "admin" && b === "scans" && /^\d+$/.test(c ?? "") && (d === "publish" || d === "discard")) {
    if (!isAdmin(user)) return detailError(403, "Admins only");
    const entry = [...state().review.entries()].find(([, r]) => r.run_id === Number(c));
    if (!entry) return detailError(404, "No scan waiting for review with that id");
    state().review.delete(entry[0]);
    if (d === "publish") {
      state().finalized.add(entry[0]);
      return json(200, { published: entry[1].students, contest_slug: entry[0] });
    }
    return json(200, { discarded: 1 });
  }

  if (request.method === "GET" && a === "scan-status" && !b) return json(200, scanQueue());

  if (request.method === "GET" && a === "analytics" && b === "topics" && !c) {
    const last = Number(url.searchParams.get("last")) || null;
    const picked = rollNos(url);
    const data = topicsFor(last, (r) => !picked || picked.has((r.roll_no ?? "").toUpperCase()), true);
    return json(200, picked ? { ...data, students: ROSTER.filter((s) => picked.has(s.niatId)).length } : data);
  }
  // One student's contest profile: history (newest first) and analytics.
  if (request.method === "GET" && a === "students" && /^\d+$/.test(b ?? "") && (!c || c === "analytics")) {
    const id = Number(b);
    const st = ROSTER[id - 1];
    if (!st) return detailError(404, "unknown student");
    const nowSec = Math.floor(Date.now() / 1000);
    const scanned = CONTESTS.filter((d) => listItem(d, nowSec).has_data);
    const mine = scanned.map((def) => ({ def, row: resultsFor(def).find((r) => r.student_id === id)! }));
    const took = (r: ResultRow) => r.status === "solved" || r.status === "zero";
    if (!c) {
      const body: ContestStudent = {
        id,
        roll_no: st.niatId,
        name: st.name,
        college: st.college,
        extra: { Section: st.section },
        leetcode_handle: st.lcHandle ?? "",
        leetcode_url: st.lcHandle ? `https://leetcode.com/u/${st.lcHandle}/` : null,
        handle_status: st.lcHandle ? "valid" : "missing",
        active: true,
        history: mine.map(({ def, row }) => ({
          contest_slug: def.slug,
          contest_title: def.title,
          start_time: epoch(def.startIst),
          questions: LABELS,
          status: row.status,
          global_rank: row.global_rank,
          ranking_url: row.ranking_url,
          rank_official: true,
          leaderboard_rank: row.global_rank,
          college_rank: row.college_rank,
          solved: took(row) ? row.solved : null,
          total_time_secs: took(row) ? Object.values(row.problems).reduce((n, p) => Math.max(n, p.solve_secs), 0) || null : null,
          problems: row.problems,
        })),
      };
      return json(200, body);
    }
    const attended = mine.filter(({ row }) => took(row));
    const solvedCounts = attended.map(({ row }) => row.solved ?? 0);
    const questions = Object.fromEntries(
      LABELS.map((label) => {
        const solvedHere = attended.filter(({ row }) => row.problems[label]);
        const secs = solvedHere.map(({ row }) => row.problems[label].solve_secs).sort((x, y) => x - y);
        return [label, { attempted_contests: attended.length, solved: solvedHere.length, solve_rate: attended.length ? solvedHere.length / attended.length : null, median_secs: secs[Math.floor(secs.length / 2)] ?? null, avg_secs: null, best_secs: secs[0] ?? null, wrong: 0, wrong_per_solve: solvedHere.length ? 0.4 : null, cohort_solve_rate: [0.7, 0.45, 0.2, 0.06][LABELS.indexOf(label)], cohort_median_secs: [900, 1800, 2700, 3600][LABELS.indexOf(label)] }];
      }),
    );
    const series = [...mine].reverse().map(({ def, row }) => ({ slug: def.slug, title: def.title, start_time: epoch(def.startIst), status: row.status, solved: took(row) ? row.solved : null, questions: 4, global_rank: row.global_rank, top_pct: row.global_rank && def.worldwide ? Math.round((row.global_rank / def.worldwide) * 10000) / 100 : null, college_rank: row.college_rank, total_time_secs: null }));
    const body: StudentAnalytics = {
      contests_scanned: mine.length,
      contests_attended: attended.length,
      attendance_rate: mine.length ? attended.length / mine.length : null,
      current_streak: took(mine[0]?.row ?? ({ status: "absent" } as ResultRow)) ? attended.length : 0,
      longest_streak: attended.length,
      absent_streak: took(mine[0]?.row ?? ({ status: "absent" } as ResultRow)) ? 0 : 1,
      avg_solved: solvedCounts.length ? solvedCounts.reduce((x, y) => x + y, 0) / solvedCounts.length : null,
      solved_std: null,
      avg_top_pct: series.filter((x) => x.top_pct !== null).reduce((n, x, _, arr) => n + (x.top_pct ?? 0) / arr.length, 0) || null,
      best_global_rank: Math.min(...attended.map(({ row }) => row.global_rank ?? Infinity)) || null,
      best_college_rank: Math.min(...attended.map(({ row }) => row.college_rank ?? Infinity)) || null,
      consistency: attended.length >= 3 ? 72 : null,
      consistency_label: attended.length >= 3 ? "Consistent" : null,
      trend: 0,
      trend_label: "steady",
      questions,
      labels: LABELS,
      series,
      rating: {
        current: 1500 + (id % 7) * 40,
        global_ranking: 400000 + id * 100,
        top_percentage: 55.2,
        contests_attended: attended.length,
        synced_at: "2026-11-26T19:00:00+00:00",
        history: series.filter((x) => took({ status: x.status } as ResultRow)).map((x, i) => ({ title: x.title, slug: x.slug, start_time: x.start_time, rating: 1450 + i * 18 + (id % 5) * 10, ranking: x.global_rank, solved: x.solved, total: 4 })),
      },
    };
    return json(200, body);
  }

  if (request.method === "GET" && a === "students" && /^\d+$/.test(b ?? "") && c === "topics") {
    const last = Number(url.searchParams.get("last")) || null;
    return json(200, topicsFor(last, (r) => r.student_id === Number(b), false));
  }

  // A requested rescan joins the sample queue (see scanQueue); its results then wait for review.
  if (request.method === "POST" && a === "admin" && b === "scans" && !c) {
    if (!isAdmin(user)) return detailError(403, "Admins only");
    const body = (await request.json().catch(() => null)) as { slug?: string } | null;
    const scanned = CONTESTS.find((x) => x.slug === body?.slug);
    if (!scanned) return detailError(422, "expected e.g. weekly-contest-520 or biweekly-contest-150");
    const now = Date.now();
    scanQueue(now);
    const st = state();
    if (!st.scans.some((x) => x.slug === scanned.slug)) st.scans.push({ slug: scanned.slug, requestedBy: user.email, at: now });
    return json(202, { id: st.scans.length, contest_slug: scanned.slug, kind: "auto", requested_by: user.email, requested_at: new Date(now).toISOString(), handled_at: null, scan_run_id: null, error: null });
  }

  return detailError(404, `The sample contest service doesn't implement ${request.method} ${path.join("/")} yet.`);
}
