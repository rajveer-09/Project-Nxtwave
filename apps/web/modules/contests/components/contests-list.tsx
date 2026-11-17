/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { StatusPill, type PillTone } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { Skeleton } from "@/common/ui/skeleton";
import { contestApi, contestDate, pct } from "@/modules/contests/api";
import type { ContestListItem } from "@/modules/contests/types";
import { cn } from "@/common/lib/utils";

export function stateLabel(c: Pick<ContestListItem, "state" | "in_review" | "final_at">): { text: string; tone: PillTone } {
  if (c.in_review) return { text: "Scan waiting for review", tone: "warning" };
  switch (c.state) {
    case "final":
      return { text: "Final results", tone: "accent" };
    case "provisional":
      return { text: c.final_at ? `Early results · final ${new Date(c.final_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Early results", tone: "neutral" };
    case "upcoming":
      return { text: "Upcoming", tone: "neutral" };
    case "live":
      return { text: "Live now", tone: "accent" };
    case "scanning":
    case "queued":
      return { text: "Scanning…", tone: "neutral" };
    case "failed":
      return { text: "Scan failed", tone: "warning" };
    default:
      return { text: "Not scanned", tone: "neutral" };
  }
}

export function ContestsList() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["contests", "list", type, q], queryFn: () => contestApi.list({ type, q }) });
  const data = query.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Contest type" className="flex flex-wrap gap-2">
          {[
            ["", "All"],
            ["weekly", "Weekly"],
            ["biweekly", "Biweekly"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => setType(value)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 text-[13px] font-semibold",
                type === value ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
          <label className="sr-only" htmlFor="contest-search">
            Search contests
          </label>
          <input
            id="contest-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search, e.g. 475"
            className="h-10 w-44 rounded-full border border-input bg-card px-3.5 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </div>
        {data ? (
          <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
            <span className={cn("size-2 rounded-full", data.worker.alive ? "bg-primary" : "bg-warning-strong")} aria-hidden="true" />
            <span>
              <b>{data.worker.alive ? "Scanner online" : "Scanner offline"}</b>
              {data.queue.length ? ` · ${data.queue.length} in queue` : " · nothing queued"}
            </span>
          </span>
        ) : null}
      </div>

      {data?.upcoming.length ? (
        <section aria-label="Upcoming contests" className="flex flex-wrap gap-3">
          {data.upcoming.map((c) => (
            <div key={c.slug} className="flex min-w-60 flex-1 flex-col gap-0.5 rounded-xl border border-dashed border-input bg-card px-4 py-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase">{c.state === "live" ? "Live now" : "Upcoming"}</span>
              <span className="font-semibold">{c.title}</span>
              <span className="text-[13px] text-muted-foreground">{contestDate(c.start_time)} · scanned automatically after it ends</span>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-label="Contests" className="overflow-hidden rounded-xl border border-border bg-card">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <EmptyState title="Couldn't load contests" description={query.error.message} />
          </div>
        ) : !data?.items.length ? (
          <div className="p-4">
            <EmptyState title="No contests match" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <caption className="sr-only">Contests</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  {["Contest", "Status", "Took part", "Avg solved", "Best global rank", "Worldwide"].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const st = stateLabel(c);
                  return (
                    <tr key={c.slug} className="hover:bg-surface-subtle">
                      <td className="border-b border-muted py-3 pr-3 pl-5">
                        <Link href={`/contests/${c.slug}`} className="font-semibold hover:text-primary">
                          {c.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">{contestDate(c.start_time)}</div>
                      </td>
                      <td className="border-b border-muted px-3 py-3">
                        <StatusPill tone={st.tone}>{st.text}</StatusPill>
                      </td>
                      <td className="border-b border-muted px-3 py-3 tabular">
                        {c.summary ? `${c.summary.participated} · ${pct(c.summary.participation_rate)}` : "—"}
                      </td>
                      <td className="border-b border-muted px-3 py-3 tabular">{c.summary?.avg_solved != null ? `${c.summary.avg_solved.toFixed(1)} / 4` : "—"}</td>
                      <td className="border-b border-muted px-3 py-3 tabular">{c.summary?.best_global_rank?.toLocaleString("en-IN") ?? "—"}</td>
                      <td className="border-b border-muted py-3 pr-5 pl-3 text-muted-foreground tabular">{c.participants_worldwide?.toLocaleString("en-IN") ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
