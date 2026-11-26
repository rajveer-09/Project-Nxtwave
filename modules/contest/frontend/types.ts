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
}

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
export type ContestScope = "all" | "mine" | `college:${string}`;

export function scopeQuery(scope: ContestScope) {
  if (scope === "mine") return "?mine=true";
  if (scope.startsWith("college:")) return `?${new URLSearchParams({ college: scope.slice("college:".length) })}`;
  return "";
}
