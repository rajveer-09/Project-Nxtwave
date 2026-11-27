/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

/**
 * Shapes of the contest service's JSON (NxtRank backend), copied from
 * nxtrank/frontend/src/api.ts. Only the fields these screens use are listed;
 * the service may send more.
 */
export type ResultStatus = "solved" | "zero" | "absent" | "invalid_handle" | "no_handle" | "duplicate_handle";
export type ContestState = "upcoming" | "live" | "scheduled" | "scanning" | "queued" | "provisional" | "final" | "failed" | "not_scanned";

export interface Summary {
  students: number;
  participated: number;
  solved_any: number;
  zero: number;
  absent: number;
  invalid_handle: number;
  no_handle: number;
  participation_rate: number | null;
  avg_solved: number | null;
  best_global_rank: number | null;
}

export interface ContestStatus {
  state: ContestState;
  has_data: boolean;
  in_review?: boolean;
  scanned_at?: string | null;
  ready_at?: string | null;
  final_at?: string | null;
  error?: string | null;
  /** While scanning: 0–1. While queued: place in the queue (1 = next). */
  progress?: number;
  position?: number;
  requested_by?: string | null;
  cancel_requested?: boolean;
}

export interface ContestListItem extends ContestStatus {
  slug: string;
  title: string;
  contest_type: string;
  start_time: number;
  duration: number;
  participants_worldwide: number | null;
  summary: Summary | null;
}

export interface WorkerStatus {
  alive: boolean;
  last_seen: string | null;
}

/** The scan the worker is running now (scan_status.queue_status). */
export interface RunningScan {
  slug: string;
  kind: string;
  progress: number;
  pages_done: number;
  pages_total: number | null;
  started_at: string | null;
  ready_at: string | null;
  requested_by: string | null;
  cancel_requested: boolean;
}

export interface QueuedScan {
  slug: string;
  kind: string;
  position: number;
  requested_by?: string | null;
  ready_at?: string | null;
}

export interface ContestPage {
  worker: WorkerStatus;
  running?: RunningScan | null;
  queue: QueuedScan[];
  typical_scan_secs?: number;
  upcoming: ContestListItem[];
  items: ContestListItem[];
  total: number;
  page: number;
  per_page: number;
  with_data: number;
  latest_slugs: string[];
}

export interface QuestionStat {
  label: string;
  question_id: number;
  credit: number;
  title: string;
  title_slug: string;
  url: string | null;
  solved: number;
  solve_rate: number | null;
  median_solve_secs: number | null;
  avg_wrong: number | null;
  /** The question's topic tags (contest page). */
  topics?: QuestionTopics;
}

// ---------------------------------------------------------------- topics (services/topics.py)

export type TagState = "official" | "provisional" | "insufficient" | "pending";

export interface QuestionTopics {
  state: TagState;
  tags: { slug: string; name: string; source: "official" | "community" }[];
  mentions: number | null;
  fetched_at: string | null;
}

export interface TopicMetrics {
  /** Times a question with this topic was in front of the students (one per student per question). */
  appeared: number;
  solved: number;
  solve_rate: number | null;
  /** Accepted ÷ (accepted + wrong tries); LeetCode reports wrong tries only for solved problems. */
  accuracy: number | null;
  median_secs: number | null;
}

export interface TopicRow extends TopicMetrics {
  slug: string;
  name: string;
  official: TopicMetrics;
  provisional_appeared: number;
  provisional_questions: number;
}

export interface TopicsData {
  topics: TopicRow[];
  /** With roll_nos: how many of those students the contest service knows. */
  students?: number;
  /** Groups only: lowest solve rate among topics seen often enough, weakest first. */
  weakest?: string[];
  coverage: {
    contests: number;
    contests_provisional: number;
    questions: number;
    official: number;
    provisional: number;
    insufficient: number;
    pending: number;
    last_refresh: string | null;
  };
}

export type TopicsQuery = { last?: number; college?: string };

export interface DraftReview {
  run_id: number;
  contest_slug: string;
  title: string | null;
  kind: string;
  finished_at: string | null;
  outdated: boolean;
  students: number;
  solved_any: number;
  participated: number;
  participated_before: number | null;
  joined: number | null;
  left: number | null;
  changed: number | null;
}

export interface CollegeBreakdown {
  college: string;
  students: number;
  participated: number;
  participation_rate: number | null;
  avg_solved: number | null;
  solved_all: number;
  best_global_rank: number | null;
  best_college_rank: number | null;
}

export interface ContestDetail {
  review?: DraftReview | null;
  slug: string;
  title: string;
  contest_type: string;
  start_time: number;
  duration: number;
  participants_worldwide: number | null;
  leetcode_url: string;
  scan: { kind: "provisional" | "final"; finished_at: string | null } | null;
  status: ContestStatus;
  summary: Summary;
  questions: QuestionStat[];
  distributions: { colleges: CollegeBreakdown[] };
  final_scan_at: string | null;
  colleges: string[];
}

export interface ProblemResult {
  solve_secs: number;
  fail_count: number;
  lang: string | null;
}

export interface ResultRow {
  student_id: number;
  roll_no: string | null;
  name: string;
  college: string;
  extra: Record<string, string>;
  leetcode_handle: string;
  status: ResultStatus;
  global_rank: number | null;
  ranking_url: string | null;
  college_rank: number | null;
  score: number | null;
  solved: number | null;
  total_time_secs: number | null;
  problems: Record<string, ProblemResult>;
}

export interface ContestResults {
  labels: string[];
  rows: ResultRow[];
}

/** Scope of the results: everyone, my students, or one college (NxtRank's ContestScope). */
export type ContestScope = "all" | "mine" | "topk" | `college:${string}`;

/**
 * The query for a scope. "mine" and "topk" send their students (NIAT IDs: the viewer's own students
 * as NxtOne assigns them, or their Top K), so contests agree with the rest of NxtOne; "mine" without
 * them falls back to NxtRank's own list.
 */
export function scopeQuery(scope: ContestScope, ids?: string[]) {
  if (scope === "topk") return `?${new URLSearchParams({ roll_nos: (ids ?? []).join(",") })}`;
  if (scope === "mine") return ids ? `?${new URLSearchParams({ roll_nos: ids.join(",") })}` : "?mine=true";
  if (scope.startsWith("college:")) return `?${new URLSearchParams({ college: scope.slice("college:".length) })}`;
  return "";
}

// ---------------------------------------------------------------- one student (contest profile)

export type HandleStatus = "valid" | "invalid" | "unchecked" | "missing" | string;

export interface HistoryItem {
  contest_slug: string;
  contest_title: string;
  start_time: number;
  questions: string[];
  status: ResultStatus;
  /** Rank on the student's LeetCode profile. */
  global_rank: number | null;
  ranking_url: string | null;
  rank_official?: boolean;
  /** Position on the contest's global leaderboard. */
  leaderboard_rank?: number | null;
  college_rank: number | null;
  solved: number | null;
  total_time_secs: number | null;
  problems: Record<string, ProblemResult>;
}

export interface ContestStudent {
  id: number;
  roll_no: string;
  name: string;
  college: string;
  extra: Record<string, string>;
  leetcode_handle: string;
  leetcode_url: string | null;
  handle_status: HandleStatus;
  active: boolean;
  /** Newest first. */
  history: HistoryItem[];
}

export interface QuestionPerf {
  attempted_contests: number;
  solved: number;
  solve_rate: number | null;
  median_secs: number | null;
  avg_secs: number | null;
  best_secs: number | null;
  wrong: number;
  wrong_per_solve: number | null;
  cohort_solve_rate?: number | null;
  cohort_median_secs?: number | null;
  cohort_wrong_per_solve?: number | null;
}

export interface StudentAnalytics {
  contests_scanned: number;
  contests_attended: number;
  attendance_rate: number | null;
  current_streak: number;
  longest_streak: number;
  absent_streak: number;
  avg_solved: number | null;
  solved_std: number | null;
  /** Average "top x %" of all participants (lower is better). */
  avg_top_pct: number | null;
  best_global_rank: number | null;
  best_college_rank: number | null;
  consistency: number | null;
  consistency_label: string | null;
  trend: number | null;
  trend_label: string | null;
  questions: Record<string, QuestionPerf>;
  labels: string[];
  /** Oldest first. */
  series: { slug: string; title: string; start_time: number; status: ResultStatus; solved: number | null; questions: number; global_rank: number | null; top_pct: number | null; college_rank: number | null; total_time_secs: number | null }[];
  rating: {
    current: number | null;
    global_ranking: number | null;
    top_percentage: number | null;
    contests_attended: number | null;
    synced_at: string | null;
    history: { title: string; slug: string; start_time: number; rating: number; ranking: number | null; solved: number | null; total: number | null }[];
  };
}
