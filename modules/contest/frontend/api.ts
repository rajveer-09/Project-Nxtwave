/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { apiFetch } from "@/common/lib/api-client";
import { scopeQuery, type ContestDetail, type ContestPage, type ContestResults, type ContestScope, type ContestStudent, type StudentAnalytics, type TopicsData, type TopicsQuery } from "@nxtone/contest-ui/types";

/** Contest service calls, always through the same-origin proxy /api/contest/*. */
const base = "/api/contest";

export const contestApi = {
  list: (q: { type?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.type) p.set("type", q.type);
    if (q.q) p.set("q", q.q);
    return apiFetch<ContestPage>(`${base}/contests?${p}`);
  },
  /** The scanner: online or not, the scan running now and the queue (small; polled while busy). */
  scanStatus: () => apiFetch<Pick<ContestPage, "worker" | "running" | "queue" | "typical_scan_secs">>(`${base}/scan-status`),
  detail: (slug: string, scope: ContestScope, myIds?: string[]) => apiFetch<ContestDetail>(`${base}/contests/${encodeURIComponent(slug)}${scopeQuery(scope, myIds)}`),
  results: (slug: string, scope: ContestScope, myIds?: string[]) => apiFetch<ContestResults>(`${base}/contests/${encodeURIComponent(slug)}/results${scopeQuery(scope, myIds)}`),
  /** One student's contest history (by the contest service's id for them). */
  student: (contestStudentId: number) => apiFetch<ContestStudent>(`${base}/students/${contestStudentId}`),
  /** Their streaks, averages, question-by-question rates, charts' series and LeetCode rating. */
  studentAnalytics: (contestStudentId: number) => apiFetch<StudentAnalytics>(`${base}/students/${contestStudentId}/analytics`),
  exportUrl: (slug: string, scope: ContestScope) => `${base}/contests/${encodeURIComponent(slug)}/export.csv${scopeQuery(scope)}`,
  publishDraft: (runId: number) => apiFetch<{ published: number; contest_slug: string }>(`${base}/admin/scans/${runId}/publish`, { method: "POST", json: {} }),
  discardDraft: (runId: number) => apiFetch<{ discarded: number }>(`${base}/admin/scans/${runId}/discard`, { method: "POST", json: {} }),
  /**
   * Super admin: scan a contest again. The worker picks the request up; "auto" means final results
   * once LeetCode has settled the contest, early ones before. The results wait for review.
   */
  requestScan: (slug: string) => apiFetch<ScanRequest>(`${base}/admin/scans`, { method: "POST", json: { slug, kind: "auto" } }),
};

export type ScanRequest = { id: number; contest_slug: string; kind: string; requested_by: string; requested_at: string | null; handled_at: string | null; error: string | null };

const topicParams = (q: TopicsQuery) => {
  const p = new URLSearchParams();
  if (q.last) p.set("last", String(q.last));
  if (q.college) p.set("college", q.college);
  return p;
};

/** Topic-wise results (as NxtRank showed them): everyone, an instructor's students, or one student. */
export const topicsApi = {
  cohort: (q: TopicsQuery = {}) => apiFetch<TopicsData>(`${base}/analytics/topics?${topicParams(q)}`),
  /** A group of students by NIAT ID (e.g. an instructor's students as NxtOne assigns them). */
  group: (niatIds: string[], q: TopicsQuery = {}) => {
    const p = topicParams(q);
    p.set("roll_nos", niatIds.join(","));
    return apiFetch<TopicsData>(`${base}/analytics/topics?${p}`);
  },
  /** One student, by the contest service's id for them. */
  student: (contestStudentId: number, last?: number) => apiFetch<TopicsData>(`${base}/students/${contestStudentId}/topics${last ? `?last=${last}` : ""}`),
};

export const contestDate = (startTime: number) =>
  new Date(startTime * 1000).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export const mmss = (secs: number | null) => (secs === null ? "—" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
