/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { Skeleton } from "@/common/ui/skeleton";
import { cn } from "@/common/lib/utils";
import { topicsApi } from "@nxtone/contest-ui/api";
import type { QuestionTopics, TopicRow, TopicsData, TopicsQuery } from "@nxtone/contest-ui/types";

/**
 * Topic-wise contest results, as NxtRank showed them: per LeetCode topic, how often it came up,
 * how often it was solved, accuracy and median time; the weakest topics first, a solve-rate chart
 * (optionally against another group) and the mix of topics. Numbers come from the contest service
 * (services/topics.py); questions whose topics aren't known yet are left out and counted.
 */

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const int = (n: number) => n.toLocaleString("en-IN");
const minutes = (secs: number | null) => {
  if (secs === null) return "—";
  const m = Math.round(secs / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** A contest question's topics, or a note that they aren't known yet. */
export function QuestionChips({ t }: { t: QuestionTopics | undefined }) {
  if (!t || !t.tags.length) {
    return (
      <span className="text-[11px] text-muted-foreground" title="Topics appear a few days after a contest">
        Topics pending
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {t.tags.map((tag) => (
        <span
          key={tag.slug}
          title={tag.source === "community" ? "From the community's discussion (LeetCode hasn't tagged it yet)" : "LeetCode's tag"}
          className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {tag.name}
        </span>
      ))}
    </span>
  );
}

const seen = (rows: TopicRow[]) => rows.filter((r) => r.appeared > 0);

/** Weakest first (groups), then the topics seen most. */
function ordered(data: TopicsData, weakest: string[]) {
  return seen(data.topics).sort((a, b) => {
    const wa = weakest.indexOf(a.slug);
    const wb = weakest.indexOf(b.slug);
    if (wa !== wb) return (wa === -1 ? 99 : wa) - (wb === -1 ? 99 : wb);
    return b.appeared - a.appeared || a.name.localeCompare(b.name);
  });
}

/** Solve rate per topic (most-seen topics), with the comparison group as a tick on each bar. */
function SolveRateBars({ rows, compare, compareLabel, weakest }: { rows: TopicRow[]; compare?: Map<string, number | null>; compareLabel?: string; weakest: string[] }) {
  const top = [...rows].sort((a, b) => b.appeared - a.appeared).slice(0, 12);
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Solve rate by topic</h3>
        {compare ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-foreground/60" />
            {compareLabel ?? "Comparison"}
          </span>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {top.map((r) => {
          const other = compare?.get(r.slug) ?? null;
          const weak = weakest.includes(r.slug);
          return (
            <li key={r.slug} className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_auto] items-center gap-2.5 text-[13px]">
              <span className="truncate font-medium text-muted-foreground" title={r.name}>
                {r.name}
              </span>
              <span className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
                <span className={cn("block h-full rounded-full", weak ? "bg-warning-strong" : "bg-primary")} style={{ width: `${Math.max(2, Math.round((r.solve_rate ?? 0) * 100))}%` }} />
                {other !== null ? <span className="absolute -top-0.5 h-3.5 w-0.5 rounded-full bg-foreground/60" style={{ left: `calc(${Math.round(other * 100)}% - 1px)` }} /> : null}
              </span>
              <span className={cn("text-right text-xs whitespace-nowrap tabular", weak && "text-warning")}>
                <b>{pct(r.solve_rate)}</b>
                {compare ? <span className="text-muted-foreground"> · {pct(other)}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Which topics the questions were about: share of question appearances, top 8 and the rest. */
function TopicMix({ rows }: { rows: TopicRow[] }) {
  const total = rows.reduce((n, r) => n + r.appeared, 0);
  const sorted = [...rows].sort((a, b) => b.appeared - a.appeared);
  const items = sorted.slice(0, 8).map((r) => ({ label: r.name, n: r.appeared }));
  const rest = sorted.slice(8).reduce((n, r) => n + r.appeared, 0);
  if (rest) items.push({ label: `Other (${sorted.length - 8})`, n: rest });
  const top = Math.max(...items.map((i) => i.n), 1);
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-sm font-semibold">Topic mix</h3>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.label} className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_2.5rem] items-center gap-2.5 text-[13px]">
            <span className="truncate font-medium text-muted-foreground" title={i.label}>
              {i.label}
            </span>
            <span className="h-2.5 rounded-full bg-muted" aria-hidden="true">
              <span className="block h-full rounded-full bg-chart-4" style={{ width: `${Math.max(2, Math.round((i.n / top) * 100))}%` }} />
            </span>
            <span className="text-right text-xs font-semibold tabular">{pct(total ? i.n / total : null)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Share of question appearances; a question with two topics counts for both.</p>
    </div>
  );
}

function CoverageNote({ data }: { data: TopicsData }) {
  const c = data.coverage;
  if (!c.questions) return null;
  const out = c.insufficient + c.pending;
  return (
    <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
      {c.contests} contest{c.contests === 1 ? "" : "s"}, {c.questions} questions.{" "}
      {out ? `${out} question${out === 1 ? " isn't" : "s aren't"} counted yet: ${out === 1 ? "its" : "their"} topics aren't known yet.` : "Every question has its topics."}
      {c.provisional ? ` ${c.provisional} use the community's topics until LeetCode tags them.` : ""}
      {c.last_refresh ? ` Topics as of ${dateTime(c.last_refresh)}.` : ""}
    </p>
  );
}

function TopicsTable({ rows, weakest, group }: { rows: TopicRow[]; weakest: string[]; group: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[620px] border-collapse text-[13px]">
        <caption className="sr-only">Results by topic</caption>
        <thead>
          <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 pl-4 font-semibold">Topic</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold" title={group ? "Times a question on this topic was in front of a student who took part" : "Questions on this topic in contests the student took part in"}>
              Appeared
            </th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold">Solved</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold">Solve rate</th>
            <th scope="col" className="border-b border-border px-3 py-2 text-right font-semibold" title="Accepted ÷ (accepted + wrong tries). LeetCode reports wrong tries only for solved problems.">
              Accuracy
            </th>
            <th scope="col" className="border-b border-border py-2 pr-4 pl-3 text-right font-semibold">Median time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug} className="border-b border-muted last:border-b-0">
              <th scope="row" className="py-2 pr-3 pl-4 text-left font-medium">
                {r.name}
                {weakest.includes(r.slug) ? <span className="ml-2 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">Weak</span> : null}
              </th>
              <td className="px-3 py-2 text-right tabular">{int(r.appeared)}</td>
              <td className="px-3 py-2 text-right tabular">{int(r.solved)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular">{pct(r.solve_rate)}</td>
              <td className="px-3 py-2 text-right tabular">{pct(r.accuracy)}</td>
              <td className="py-2 pr-4 pl-3 text-right tabular">{minutes(r.median_secs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The whole topics block for loaded data. */
export function TopicsPanel({ data, group, compare, compareLabel }: { data: TopicsData; group: boolean; compare?: TopicsData; compareLabel?: string }) {
  const weakest = group ? (data.weakest ?? []) : [];
  const rows = ordered(data, weakest);
  if (!rows.length) {
    return (
      <div className="flex flex-col gap-3">
        <CoverageNote data={data} />
        <EmptyState title="No topic data yet" description="Topics show once these students have taken part in contests whose questions are tagged." />
      </div>
    );
  }
  const rates = compare ? new Map(compare.topics.map((t) => [t.slug, t.solve_rate] as const)) : undefined;
  return (
    <div className="flex flex-col gap-5">
      {weakest.length ? (
        <p className="text-[13px]">
          <span className="font-semibold">Weakest topics:</span>{" "}
          {weakest
            .map((slug) => data.topics.find((t) => t.slug === slug))
            .filter((t): t is TopicRow => !!t)
            .map((t) => `${t.name} (${pct(t.solve_rate)})`)
            .join(" · ")}
          <span className="text-muted-foreground"> · lowest solve rate among topics seen 10+ times</span>
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SolveRateBars rows={rows} compare={rates} compareLabel={compareLabel} weakest={weakest} />
        <TopicMix rows={rows} />
      </div>
      <CoverageNote data={data} />
      <TopicsTable rows={rows} weakest={weakest} group={group} />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading topics">
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

const PERIODS: [number | undefined, string][] = [
  [5, "Last 5"],
  [10, "Last 10"],
  [20, "Last 20"],
  [undefined, "All contests"],
];

const pill = (on: boolean) =>
  cn("min-h-9 rounded-full border px-3 text-[13px] font-semibold", on ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted");

function Pills<T>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, text]) => (
        <button key={text} type="button" aria-pressed={v === value} onClick={() => onChange(v)} className={pill(v === value)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>
      {children}
    </div>
  );
}

/**
 * Contests › Topics: everyone, one college, or (for someone with students of their own) their
 * students as NxtOne assigns them, over the last N contests. Colleges come from NxtOne's roster
 * (NIAT IDs per college), like the "By college" view.
 */
export function TopicsView({ colleges, myIds }: { colleges: Record<string, string[]>; myIds: string[] }) {
  const [last, setLast] = useState<number | undefined>(10);
  const [college, setCollege] = useState("");
  const [whose, setWhose] = useState<"mine" | "all">(myIds.length ? "mine" : "all");
  const q: TopicsQuery = { last };
  const mine = whose === "mine" && myIds.length > 0;
  const names = Object.keys(colleges).sort();
  // The students shown, as NIAT IDs (null = everyone).
  const inCollege = college ? new Set(colleges[college] ?? []) : null;
  const ids = mine ? (inCollege ? myIds.filter((id) => inCollege.has(id)) : myIds) : inCollege ? [...inCollege] : null;
  const data = useQuery({
    queryKey: ["contests", "topics", mine ? "mine" : "all", last ?? "all", college],
    queryFn: () => (ids ? topicsApi.group(ids, q) : topicsApi.cohort(q)),
    placeholderData: keepPreviousData,
  });
  // On "My students" or a college, everyone's rates as a tick on each bar.
  const everyone = useQuery({ queryKey: ["contests", "topics", "all", last ?? "all", ""], queryFn: () => topicsApi.cohort(q), enabled: ids !== null });
  const outdated = ids !== null && data.data && data.data.students === undefined;

  return (
    <section aria-label="Topics" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">Topics</h2>
        <p className="text-xs text-muted-foreground">
          How {mine ? (college ? `your ${college} students` : "your students") : college ? `${college} students` : "all students"} do on each LeetCode topic in contests they took part in.
          {ids && data.data?.students !== undefined ? ` ${data.data.students} of these ${ids.length} students are in the contest tracker.` : ""}
        </p>
      </div>
      {/* The filters sit in their own row, each group labelled, so changing one never moves the others. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
        {myIds.length ? (
          <FilterGroup title="Whose">
            <Pills
              label="Whose results"
              options={[
                ["mine", "My students"],
                ["all", "Everyone"],
              ]}
              value={whose}
              onChange={setWhose}
            />
          </FilterGroup>
        ) : null}
        <FilterGroup title="Contests">
          <Pills label="Contests" options={PERIODS} value={last} onChange={setLast} />
        </FilterGroup>
        {names.length > 1 ? (
          <FilterGroup title="College">
            <Pills label="College" options={[["", "All colleges"], ...names.map((c): [string, string] => [c, c])]} value={college} onChange={setCollege} />
          </FilterGroup>
        ) : null}
      </div>
      {outdated ? (
        <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-[13px]">The contest service hasn&apos;t been updated yet, so it can&apos;t pick out these students. Showing everyone for now.</p>
      ) : null}
      <div className={cn("transition-opacity", data.isPlaceholderData && "opacity-60")}>
        {data.isPending ? (
          <Loading />
        ) : data.isError ? (
          <EmptyState title="Couldn't load topics" description={data.error.message} />
        ) : (
          <TopicsPanel data={data.data} group compare={ids && !outdated ? everyone.data : undefined} compareLabel="Everyone" />
        )}
      </div>
    </section>
  );
}

/** A student's page: their topics, with everyone's solve rate as a tick on each bar. */
export function StudentTopics({ contestStudentId, name }: { contestStudentId: number; name: string }) {
  const data = useQuery({ queryKey: ["contests", "topics", "student", contestStudentId], queryFn: () => topicsApi.student(contestStudentId) });
  const everyone = useQuery({ queryKey: ["contests", "topics", "all", "all", ""], queryFn: () => topicsApi.cohort({}), staleTime: 5 * 60_000 });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-[15px] font-bold">Topics in contest problems</h3>
        <p className="text-xs text-muted-foreground">{name}&apos;s results per LeetCode topic, in every contest they took part in; the tick is all students.</p>
      </div>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <EmptyState title="Couldn't load topics" description={data.error.message} />
      ) : (
        <TopicsPanel data={data.data} group={false} compare={everyone.data} compareLabel="All students" />
      )}
    </div>
  );
}
