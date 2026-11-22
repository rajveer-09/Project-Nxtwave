/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import type { ContestDetail, ContestListItem, ContestPage, ContestResults, DraftReview, QuestionStat, ResultRow, Summary } from "@nxtone/contest-ui/types";
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

type State = { finalized: Set<string>; review: Map<string, DraftReview> };
const g = globalThis as unknown as { __contestState?: State };
function state(): State {
  if (!g.__contestState) {
    g.__contestState = {
      // Weekly 476 has early results until its final scan; Biweekly 170 has a manual scan waiting for review.
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

function scoped(rows: ResultRow[], url: URL, user: SessionUser) {
  const college = url.searchParams.get("college");
  const mine = url.searchParams.get("mine") === "true";
  const myIds = new Set(ROSTER.filter((s) => s.instructor === user.name).map((s) => s.niatId));
  return rows.filter((r) => (!college || r.college === college) && (!mine || myIds.has(r.roll_no ?? "")));
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
      worker: { alive: true, last_seen: new Date(Date.now() - 40_000).toISOString() },
      queue: [],
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
      status: { state: item.state, has_data: item.has_data, in_review: item.in_review, final_at: item.final_at },
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

  return detailError(404, `The sample contest service doesn't implement ${request.method} ${path.join("/")} yet.`);
}
