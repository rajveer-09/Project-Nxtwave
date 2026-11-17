/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { apiFetch } from "@/common/lib/api-client";
import { scopeQuery, type ContestDetail, type ContestPage, type ContestResults, type ContestScope } from "@nxtone/contest-ui/types";

/** Contest service calls, always through the same-origin proxy /api/contest/*. */
const base = "/api/contest";

export const contestApi = {
  list: (q: { type?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.type) p.set("type", q.type);
    if (q.q) p.set("q", q.q);
    return apiFetch<ContestPage>(`${base}/contests?${p}`);
  },
  detail: (slug: string, scope: ContestScope) => apiFetch<ContestDetail>(`${base}/contests/${encodeURIComponent(slug)}${scopeQuery(scope)}`),
  results: (slug: string, scope: ContestScope) => apiFetch<ContestResults>(`${base}/contests/${encodeURIComponent(slug)}/results${scopeQuery(scope)}`),
  exportUrl: (slug: string, scope: ContestScope) => `${base}/contests/${encodeURIComponent(slug)}/export.csv${scopeQuery(scope)}`,
  publishDraft: (runId: number) => apiFetch<{ published: number; contest_slug: string }>(`${base}/admin/scans/${runId}/publish`, { method: "POST", json: {} }),
  discardDraft: (runId: number) => apiFetch<{ discarded: number }>(`${base}/admin/scans/${runId}/discard`, { method: "POST", json: {} }),
};

export const contestDate = (startTime: number) =>
  new Date(startTime * 1000).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export const mmss = (secs: number | null) => (secs === null ? "—" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
