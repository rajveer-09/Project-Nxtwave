/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { DailyBars, TrendLine, ValueLine } from "@/common/components/charts";
import { EmptyState } from "@/common/components/empty-state";
import { Skeleton } from "@/common/ui/skeleton";
import { cn } from "@/common/lib/utils";
import { contestApi, mmss } from "@nxtone/contest-ui/api";
import { StudentTopics } from "@nxtone/contest-ui/components/topics";
import type { ContestStudent, HistoryItem, ResultStatus, StudentAnalytics } from "@nxtone/contest-ui/types";

/**
 * A student's contest profile, as NxtRank showed it: how regularly they take part, how they do
 * (tiles), question by question against everyone, charts over the contests, topics and the full
 * contest history. Everything comes from the contest service.
 */

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN"));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const shortTitle = (t: string) => t.replace(/^Weekly Contest /, "W").replace(/^Biweekly Contest /, "BW");
const contestDay = (start: number) => new Date(start * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const duration = (secs: number | null | undefined) => {
  if (secs == null) return "—";
  const m = Math.round(secs / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

const STATUS: Record<ResultStatus, { text: string; tone: string }> = {
  solved: { text: "Took part", tone: "text-accent-strong" },
  zero: { text: "Took part · 0 solved", tone: "" },
  absent: { text: "Absent", tone: "text-warning" },
  invalid_handle: { text: "Handle not found", tone: "text-muted-foreground" },
  no_handle: { text: "No handle", tone: "text-muted-foreground" },
  duplicate_handle: { text: "Handle shared", tone: "text-muted-foreground" },
};

const TREND: Record<string, string> = { improving: "Improving", declining: "Declining", steady: "Steady" };

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5 sm:p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-heading text-2xl font-semibold tabular sm:text-[26px]", warn && "text-warning")}>{value}</span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-3.5 sm:p-4", className)}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Tiles({ a }: { a: StudentAnalytics }) {
  const r = a.rating;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <Tile label="Contests taken part in" value={`${a.contests_attended} / ${a.contests_scanned}`} sub={`${pct(a.attendance_rate)} of scanned contests`} />
      <Tile
        label="Streak"
        value={a.absent_streak ? `${a.absent_streak} missed` : `${a.current_streak} in a row`}
        sub={`longest ${a.longest_streak}`}
        warn={a.absent_streak >= 3}
      />
      <Tile label="Average solved" value={a.avg_solved == null ? "—" : `${a.avg_solved.toFixed(1)} / 4`} sub="in contests taken part in" />
      <Tile label="Consistency" value={a.consistency == null ? "—" : String(a.consistency)} sub={a.consistency_label ?? "needs 3+ contests"} />
      <Tile label="Trend" value={a.trend_label ? (TREND[a.trend_label] ?? a.trend_label) : "—"} sub="solved, recent contests vs earlier" warn={a.trend_label === "declining"} />
      <Tile label="Average global position" value={a.avg_top_pct == null ? "—" : `Top ${a.avg_top_pct.toFixed(1)}%`} sub={a.best_global_rank ? `best profile rank ${int(a.best_global_rank)}` : undefined} />
      <Tile label="Best college rank" value={a.best_college_rank ? `#${a.best_college_rank}` : "—"} sub="among NxtWave students" />
      <Tile
        label="LeetCode rating"
        value={r.current == null ? "—" : int(Math.round(r.current))}
        sub={r.current == null ? "not rated yet" : `top ${r.top_percentage ?? "—"}%${r.synced_at ? ` · as of ${dateTime(r.synced_at)}` : ""}`}
      />
    </div>
  );
}

/** Q1–Q4: how often they solved it when they took part, against everyone (the tick). */
function QuestionByQuestion({ a }: { a: StudentAnalytics }) {
  return (
    <Panel title="Question by question" sub="When they took part: how often they solved each question, with everyone's rate as the tick.">
      <ul className="flex flex-col gap-3">
        {a.labels.map((label) => {
          const q = a.questions[label];
          if (!q) return null;
          const mine = q.solve_rate ?? 0;
          const all = q.cohort_solve_rate ?? null;
          return (
            <li key={label} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 text-[13px]">
              <span className="pt-0.5 font-semibold">{label}</span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                  <span className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round(mine * 100))}%` }} />
                    {all !== null ? <span className="absolute -top-0.5 h-3.5 w-0.5 rounded-full bg-foreground/60" style={{ left: `calc(${Math.round(all * 100)}% - 1px)` }} /> : null}
                  </span>
                  <span className="text-xs whitespace-nowrap tabular">
                    <b>{pct(q.solve_rate)}</b> <span className="text-muted-foreground">· everyone {pct(all)}</span>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Solved {q.solved} of {q.attempted_contests} · median {duration(q.median_secs)} (everyone {duration(q.cohort_median_secs)})
                  {q.best_secs != null ? ` · best ${duration(q.best_secs)}` : ""}
                  {q.wrong_per_solve != null ? ` · ${q.wrong_per_solve.toFixed(1)} wrong tries per solve` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Charts({ a }: { a: StudentAnalytics }) {
  const solved = a.series.map((s) => ({ day: s.slug, label: shortTitle(s.title), value: s.status === "solved" || s.status === "zero" ? s.solved : null }));
  // "Ahead of x% of participants" (100 − top %), so higher is better on the chart.
  const position = a.series.map((s) => ({ day: s.slug, label: shortTitle(s.title), value: s.top_pct == null ? null : Math.round((100 - s.top_pct) * 10) / 10 }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Problems solved" sub="Per scanned contest; gaps are contests they missed.">
        {solved.length ? <DailyBars data={solved} valueLabel="Solved" height={200} /> : <p className="text-sm text-muted-foreground">No scanned contests yet.</p>}
      </Panel>
      <Panel title="Global position" sub="Share of all participants they finished ahead of (higher is better).">
        {position.some((p) => p.value !== null) ? <TrendLine data={position} valueLabel="Ahead of" height={200} /> : <p className="text-sm text-muted-foreground">No ranked contests yet.</p>}
      </Panel>
    </div>
  );
}

function RatingChart({ a }: { a: StudentAnalytics }) {
  const rating = a.rating.history.map((h) => ({ day: h.slug, label: shortTitle(h.title), value: Math.round(h.rating) }));
  return (
    <Panel title="LeetCode rating" sub="After each rated contest, from LeetCode.">
      {/* Until LeetCode rates them, its history holds only the 1500 starting value: nothing to chart. */}
      {rating.length && a.rating.current !== null ? <ValueLine data={rating} valueLabel="Rating" height={220} /> : <p className="text-sm text-muted-foreground">Not rated by LeetCode yet.</p>}
    </Panel>
  );
}

function History({ s }: { s: ContestStudent }) {
  const labels = [...new Set(s.history.flatMap((h) => h.questions))].sort();
  return (
    <section aria-label="Contest history" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold">Contest history</h2>
        <span className="text-xs text-muted-foreground">Newest first · profile rank is the rank on their LeetCode profile; the leaderboard rank opens that page of the contest leaderboard</span>
      </div>
      {!s.history.length ? (
        <div className="p-4">
          <EmptyState title="No scanned contests yet" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <caption className="sr-only">Contest history</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                <th scope="col" className="sticky left-0 z-[1] border-b border-border bg-surface-subtle py-2.5 pr-3 pl-4 font-semibold">Contest</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">Profile rank</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">Leaderboard rank</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">College rank</th>
                <th scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">Solved</th>
                {labels.map((l) => (
                  <th key={l} scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">
                    {l}
                  </th>
                ))}
                <th scope="col" className="border-b border-border py-2.5 pr-4 pl-3 text-right font-semibold">Total time</th>
              </tr>
            </thead>
            <tbody>
              {s.history.map((h: HistoryItem) => {
                const st = STATUS[h.status] ?? { text: h.status, tone: "" };
                const took = h.status === "solved" || h.status === "zero";
                return (
                  <tr key={h.contest_slug} className="group hover:bg-surface-subtle">
                    <td className="sticky left-0 z-[1] border-b border-muted bg-card py-2.5 pr-3 pl-4 group-hover:bg-surface-subtle">
                      <Link href={`/contests/${h.contest_slug}`} className="font-semibold hover:text-primary">
                        {h.contest_title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{contestDay(h.start_time)}</div>
                    </td>
                    <td className={cn("border-b border-muted px-3 py-2.5 text-xs font-semibold", st.tone)}>{st.text}</td>
                    <td className="border-b border-muted px-3 py-2.5 text-right tabular">{took ? int(h.global_rank) : "—"}</td>
                    <td className="border-b border-muted px-3 py-2.5 text-right tabular">
                      {took && h.leaderboard_rank ? (
                        h.ranking_url ? (
                          <a href={h.ranking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" title="Open this page of the contest leaderboard">
                            {int(h.leaderboard_rank)}
                            <ExternalLink aria-hidden="true" className="size-3" />
                          </a>
                        ) : (
                          int(h.leaderboard_rank)
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border-b border-muted px-3 py-2.5 text-right font-semibold tabular">{took && h.college_rank ? `#${h.college_rank}` : "—"}</td>
                    <td className="border-b border-muted px-3 py-2.5 text-right tabular">{h.solved == null ? "—" : `${h.solved} / ${h.questions.length}`}</td>
                    {labels.map((l) => {
                      const p = h.problems[l];
                      return (
                        <td key={l} className="border-b border-muted px-3 py-2.5 text-right text-xs whitespace-nowrap tabular">
                          {p ? (
                            <>
                              <span className="font-semibold text-accent-strong">{mmss(p.solve_secs)}</span>
                              {p.fail_count ? <span className="text-warning"> +{p.fail_count}</span> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-muted py-2.5 pr-4 pl-3 text-right tabular">{h.total_time_secs ? mmss(h.total_time_secs) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** The data part of the contest profile (the page draws the header). */
export function StudentContestProfile({ contestId, firstName }: { contestId: number; firstName: string }) {
  const student = useQuery({ queryKey: ["contests", "student", contestId], queryFn: () => contestApi.student(contestId) });
  const analytics = useQuery({ queryKey: ["contests", "student-analytics", contestId], queryFn: () => contestApi.studentAnalytics(contestId) });

  return (
    <div className="flex flex-col gap-5">
      {analytics.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-xl" />
          ))}
        </div>
      ) : analytics.isError ? (
        <EmptyState title="Couldn't load contest analytics" description={analytics.error.message} />
      ) : (
        <>
          <Tiles a={analytics.data} />
          <div className="grid gap-4 xl:grid-cols-2">
            <QuestionByQuestion a={analytics.data} />
            <RatingChart a={analytics.data} />
          </div>
          <Charts a={analytics.data} />
          <StudentTopics contestStudentId={contestId} name={firstName} />
        </>
      )}
      {student.isPending ? <Skeleton className="h-80 rounded-xl" /> : student.isError ? <EmptyState title="Couldn't load contest history" description={student.error.message} /> : <History s={student.data} />}
    </div>
  );
}

