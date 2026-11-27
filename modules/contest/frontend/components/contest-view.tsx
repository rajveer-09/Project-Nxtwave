/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BarList } from "@/common/components/bar-list";
import { StatusPill } from "@/common/components/chips";
import { useConfirm } from "@/common/components/confirm";
import { EmptyState } from "@/common/components/empty-state";
import { SearchField } from "@/common/components/search-field";
import { searchMatcher } from "@/common/lib/search";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { contestApi, contestDate, mmss, pct } from "@nxtone/contest-ui/api";
import type { ContestScope, ResultRow } from "@nxtone/contest-ui/types";
import { cn } from "@/common/lib/utils";
import { LeetCodeLink } from "@/common/components/leetcode-link";
import { stateLabel, WakingNote } from "@nxtone/contest-ui/components/contests-list";
import { ContestScanPanel } from "@nxtone/contest-ui/components/scan-activity";
import { QuestionChips } from "@nxtone/contest-ui/components/topics";

const STATUS_TEXT: Record<ResultRow["status"], string> = {
  solved: "Took part",
  zero: "Took part · 0 solved",
  absent: "Absent",
  invalid_handle: "Handle not found",
  no_handle: "No handle",
  duplicate_handle: "Handle shared",
};

const busy = (state: string | undefined) => state === "queued" || state === "scanning";

/** myIds: the viewer's own students as NxtOne assigns them (NIAT IDs); none = no "My students". */
export function ContestView({ slug, canReview, canRescan = false, myIds = [], topKIds = [] }: { slug: string; canReview: boolean; canRescan?: boolean; myIds?: string[]; topKIds?: string[] }) {
  const hasStudents = myIds.length > 0;
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ContestScope>(hasStudents ? "mine" : "all");
  // While a scan is queued or running, follow it every few seconds.
  const detail = useQuery({
    queryKey: ["contests", "detail", slug, scope],
    queryFn: () => contestApi.detail(slug, scope, scope === "topk" ? topKIds : myIds),
    refetchInterval: (q) => (busy(q.state.data?.status.state) ? 5_000 : false),
  });
  const results = useQuery({ queryKey: ["contests", "results", slug, scope], queryFn: () => contestApi.results(slug, scope, scope === "topk" ? topKIds : myIds) });
  const state = detail.data?.status.state;
  // Pages read and whether the scanner is online, while this contest is queued or scanning.
  const scan = useQuery({ queryKey: ["contests", "scan-status"], queryFn: contestApi.scanStatus, enabled: busy(state), refetchInterval: busy(state) ? 5_000 : false });
  // When a scan finishes, show what it found.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy(state)) void queryClient.invalidateQueries({ queryKey: ["contests"] });
    wasBusy.current = busy(state);
  }, [state, queryClient]);
  const [query, setQuery] = useState("");
  const match = searchMatcher(query);
  const shownRows = (results.data?.rows ?? []).filter((r) => match(r.name, r.roll_no, r.leetcode_handle, r.college, r.extra.section));

  const review = useMutation({
    mutationFn: async (action: "publish" | "discard") => {
      const runId = detail.data!.review!.run_id;
      if (action === "publish") await contestApi.publishDraft(runId);
      else await contestApi.discardDraft(runId);
    },
    onSuccess: async (_, action) => {
      toast.success(action === "publish" ? "Scan published. Results are now final." : "Scan discarded. The earlier results stay.");
      await queryClient.invalidateQueries({ queryKey: ["contests"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {detail.failureCount ? <WakingNote /> : null}
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }
  if (detail.isError) return <EmptyState title="Couldn't load this contest" description={detail.error.message} />;
  const d = detail.data!;
  const st = stateLabel({ state: d.status.state, in_review: d.status.in_review, final_at: d.status.final_at ?? null });
  const s = d.summary;

  const scopes: { value: ContestScope; label: string }[] = [
    ...(hasStudents ? [{ value: "mine" as ContestScope, label: "My students" }] : []),
    ...(topKIds.length ? [{ value: "topk" as ContestScope, label: `Top K (${topKIds.length})` }] : []),
    { value: "all", label: "Everyone" },
    ...d.colleges.map((c) => ({ value: `college:${c}` as ContestScope, label: c })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/contests" className="text-[13px] font-semibold text-primary hover:text-accent-strong">
            ← All contests
          </Link>
          <h1 className="text-[30px] font-semibold">{d.title}</h1>
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            {contestDate(d.start_time)} · {d.participants_worldwide?.toLocaleString("en-IN") ?? "—"} worldwide
            <StatusPill tone={st.tone}>{st.text}</StatusPill>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={d.leetcode_url} target="_blank" rel="noreferrer" className="flex min-h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-[13px] font-semibold hover:bg-muted">
            LeetCode page <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
          <a href={contestApi.exportUrl(slug, scope)} className="flex min-h-10 items-center rounded-lg border border-input bg-card px-3 text-[13px] font-semibold hover:bg-muted">
            Export CSV
          </a>
          {canRescan ? <RescanButton slug={slug} title={d.title} busy={busy(d.status.state)} finalAt={d.final_scan_at} /> : null}
        </div>
      </div>

      {busy(d.status.state) ? <ContestScanPanel status={d.status} scan={scan.data} /> : null}

      {canReview && d.review ? (
        <section aria-label="Scan waiting for review" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3.5">
          <div className="flex flex-col gap-0.5 text-[13px] text-[#6E3005] dark:text-[#F5B98A]">
            <span className="font-bold">A manual {d.review.kind} scan is waiting for your review</span>
            <span>
              {d.review.participated} took part{d.review.participated_before !== null ? ` (was ${d.review.participated_before})` : ""} · {d.review.joined ?? 0} newly joined · {d.review.left ?? 0} dropped out ·{" "}
              {d.review.changed ?? 0} changed ranks. Nothing changes for others until you publish.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10" disabled={review.isPending} onClick={() => review.mutate("discard")}>
              Discard
            </Button>
            <Button className="h-10" disabled={review.isPending || d.review.outdated} onClick={() => review.mutate("publish")}>
              Publish results
            </Button>
          </div>
        </section>
      ) : null}

      {!d.status.has_data ? (
        <EmptyState title="No results yet" description="Results appear about 30 minutes after the contest ends, when the scanner runs." />
      ) : (
        <>
          <div role="group" aria-label="Whose results" className="flex flex-wrap gap-2">
            {scopes.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={scope === option.value}
                onClick={() => setScope(option.value)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 text-[13px] font-semibold",
                  scope === option.value ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {[
              ["Took part", `${s.participated} of ${s.students}`, `${pct(s.participation_rate)} of verified handles`],
              ["Avg solved", s.avg_solved !== null ? `${s.avg_solved.toFixed(1)} / 4` : "—", `${s.solved_any} solved at least one`],
              ["Best global rank", s.best_global_rank?.toLocaleString("en-IN") ?? "—", "among these students"],
              ["Absent", String(s.absent), `${s.zero} took part but solved none`],
              ["No handle", String(s.no_handle + s.invalid_handle), "can't be scanned"],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="font-heading text-2xl font-semibold tabular">{value}</dd>
                <dd className="text-xs text-muted-foreground">{sub}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-start gap-4">
            <section aria-label="Questions" className="min-w-0 flex-[2_1_480px] overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[13px]">
                  <caption className="sr-only">How each question went</caption>
                  <thead>
                    <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                      {["Question", "Points", "Solved", "Median time", "Avg wrong tries"].map((h) => (
                        <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-4 last:pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.questions.map((q) => (
                      <tr key={q.label}>
                        <td className="border-b border-muted py-2.5 pr-3 pl-4">
                          <div className="font-semibold">{q.title}</div>
                          <div className="mt-1">
                            <QuestionChips t={q.topics} />
                          </div>
                        </td>
                        <td className="border-b border-muted px-3 py-2.5 tabular">{q.credit}</td>
                        <td className="border-b border-muted px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <span className="block h-full bg-primary" style={{ width: `${Math.round((q.solve_rate ?? 0) * 100)}%` }} />
                            </span>
                            <span className="tabular">
                              {q.solved} · {pct(q.solve_rate)}
                            </span>
                          </span>
                        </td>
                        <td className="border-b border-muted px-3 py-2.5 tabular">{mmss(q.median_solve_secs)}</td>
                        <td className="border-b border-muted py-2.5 pr-4 pl-3 tabular">{q.avg_wrong?.toFixed(1) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section aria-label="By college" className="min-w-0 flex-[1_1_280px] rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 text-base font-semibold">Participation by college</h2>
              <BarList
                items={d.distributions.colleges.map((c) => ({
                  label: c.college,
                  value: c.participation_rate ?? 0,
                  display: pct(c.participation_rate),
                  warn: (c.participation_rate ?? 0) < 0.5,
                }))}
                max={1}
                labelWidth="3rem"
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {d.distributions.colleges.map((c) => `${c.college}: avg ${c.avg_solved?.toFixed(1) ?? "—"} solved, ${c.solved_all} solved all 4`).join(" · ")}
              </p>
            </section>
          </div>

          <section aria-label="Results" className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">College leaderboard</h2>
              <div className="flex flex-wrap items-center gap-3">
                <SearchField label="Search results" placeholder="Name, NIAT ID, handle or section" value={query} onChange={setQuery} className="w-64" />
                <span className="text-xs text-muted-foreground">
                  {query.trim() ? `${shownRows.length} of ${results.data?.rows.length ?? 0}` : (results.data?.rows.length ?? 0)} students
                </span>
              </div>
            </div>
            {results.isLoading ? (
              <Skeleton className="m-4 h-60" />
            ) : results.isError ? (
              <div className="p-4">
                <EmptyState title="Couldn't load results" description={results.error.message} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-[13px]">
                  <caption className="sr-only">Results, ranked within each college</caption>
                  <thead>
                    <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                      {["College rank", "Student", "Status", "Solved", "Score", "Time", "Global rank", ...(results.data?.labels ?? [])].map((h) => (
                        <th key={h} scope="col" className="border-b border-border px-2.5 py-2.5 first:pl-4 last:pr-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!shownRows.length && query.trim() ? (
                      <tr>
                        <td colSpan={7 + (results.data?.labels.length ?? 0)} className="px-4 py-6 text-center text-muted-foreground">
                          No student matches “{query.trim()}”.
                        </td>
                      </tr>
                    ) : null}
                    {shownRows.map((r) => (
                      <tr key={r.student_id} className={cn(r.status !== "solved" && r.status !== "zero" && "text-muted-foreground")}>
                        <td className="border-b border-muted py-2.5 pr-2.5 pl-4 font-bold tabular">{r.college_rank ? `#${r.college_rank}` : "—"}</td>
                        <td className="border-b border-muted px-2.5 py-2.5">
                          {r.roll_no ? (
                            <Link href={`/contests/students/${r.roll_no}?from=${slug}`} className="font-semibold text-foreground hover:text-primary" title="Open their contest profile">
                              {r.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{r.name}</span>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {r.college} · {r.extra.section} ·{" "}
                            {/* A handle LeetCode doesn't know would only open a "user not found" page. */}
                            {r.leetcode_handle && r.status !== "invalid_handle" ? <LeetCodeLink handle={r.leetcode_handle} /> : r.leetcode_handle || "no handle"}
                          </div>
                        </td>
                        <td className={cn("border-b border-muted px-2.5 py-2.5 text-xs font-semibold", r.status === "absent" && "text-warning")}>{STATUS_TEXT[r.status]}</td>
                        <td className="border-b border-muted px-2.5 py-2.5 tabular">{r.solved ?? "—"}</td>
                        <td className="border-b border-muted px-2.5 py-2.5 tabular">{r.score ?? "—"}</td>
                        <td className="border-b border-muted px-2.5 py-2.5 tabular">{mmss(r.total_time_secs)}</td>
                        <td className="border-b border-muted px-2.5 py-2.5 tabular">
                          {r.global_rank && r.ranking_url ? (
                            <a href={r.ranking_url} target="_blank" rel="noreferrer" className="hover:text-primary">
                              {r.global_rank.toLocaleString("en-IN")}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        {results.data!.labels.map((label) => {
                          const p = r.problems[label];
                          return (
                            <td key={label} className="border-b border-muted px-2.5 py-2.5 text-xs last:pr-4">
                              {p ? (
                                <span className="tabular">
                                  <span className="font-semibold text-accent-strong">{mmss(p.solve_secs)}</span>
                                  {p.fail_count ? <span className="text-warning"> ({p.fail_count}✗)</span> : null}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Super admin: ask the scanner to read this contest again. Confirms first; the results then wait for review. */
function RescanButton({ slug, title, busy, finalAt }: { slug: string; title: string; busy: boolean; finalAt: string | null }) {
  const queryClient = useQueryClient();
  const { ask, dialog } = useConfirm();
  const scan = useQuery({ queryKey: ["contests", "scan-status"], queryFn: contestApi.scanStatus });
  const alive = scan.data?.worker.alive;

  const open = () => {
    const final = !finalAt || Date.now() >= new Date(finalAt).getTime();
    ask({
      title: `Rescan ${title}?`,
      description:
        "The scanner reads this contest from LeetCode again. The new results wait here for an admin to publish or discard them; until then everyone keeps seeing the current results.",
      changes: [
        {
          label: "Results",
          after: final ? "Final results" : `Early results (final from ${new Date(finalAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`,
        },
        {
          label: "Scanner",
          after: alive === undefined ? "Checking…" : alive ? "Online, starts within a minute" : "Offline: the rescan waits until the worker is started on the scanning laptop",
        },
      ],
      confirmLabel: "Rescan",
      action: async () => {
        try {
          await contestApi.requestScan(slug);
          return { ok: true as const, message: alive === false ? "Rescan queued. It starts when the scanner is back online." : "Rescan queued." };
        } catch (error) {
          return { ok: false as const, error: error instanceof Error ? error.message : "Couldn't request the rescan." };
        }
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["contests"] }),
    });
  };

  return (
    <>
      <Button variant="outline" className="h-10 gap-1.5 text-[13px] font-semibold" disabled={busy} onClick={open} title={busy ? "A scan of this contest is already queued or running" : undefined}>
        <RefreshCw aria-hidden="true" className={cn("size-3.5", busy && "animate-spin")} />
        {busy ? "Scanning…" : "Rescan"}
      </Button>
      {dialog}
    </>
  );
}
