/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { Code2 } from "lucide-react";
import { IntentLink } from "@/common/components/intent-link";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { formatDate } from "@/common/lib/dates";
import { coveredLabel, isSupport, STATUS_LABEL, type Interaction } from "@nxtone/interactions-ui/lib/types";

/** `codeRooms`: interaction id → code room saved with it (shows a "Code" link). */
/** `allHref`: where to see every row when only the first ones are listed (Today's interactions with the same filters). */
export function RecentLogs({ rows, total, exportHref, allHref, codeRooms = {} }: { rows: Interaction[]; total: number; exportHref: string; allHref?: string; codeRooms?: Record<string, string> }) {
  return (
    <section aria-labelledby="recent-h" className="min-w-0 flex-[1.5_1_560px] overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-4">
        <div className="flex flex-col">
          <h2 id="recent-h" className="text-base font-semibold">
            Recent interactions
          </h2>
          <span className="text-xs text-muted-foreground">
            Showing {rows.length} of {total}
            {allHref ? (
              <>
                {" · "}
                <IntentLink href={allHref} className="font-semibold text-primary hover:text-accent-strong">
                  See all {total.toLocaleString("en-IN")} →
                </IntentLink>
              </>
            ) : null}
          </span>
        </div>
        <a href={exportHref} download className="flex min-h-9 items-center rounded-lg border border-input bg-card px-3 text-[13px] font-semibold hover:bg-muted">
          Export CSV
        </a>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <caption className="sr-only">Recent interactions</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["Date", "Student", "Covered", "Questions", "Outcome", "Rating"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-2.5 py-2.5 first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => {
                const off = it.questions.filter((q) => q.offRoadmap).length;
                return (
                  <tr key={it.id}>
                    <td className="border-b border-muted py-2.5 pr-2.5 pl-5 whitespace-nowrap text-sidebar-foreground">{formatDate(it.date)}</td>
                    <td className="border-b border-muted px-2.5 py-2.5">
                      <IntentLink href={`/students/${it.niatId}`} className="font-semibold hover:text-primary">
                        {it.studentName}
                      </IntentLink>
                      <div className="text-xs text-muted-foreground">
                        round {it.round} · {it.takenBy}
                        {isSupport(it) ? (
                          <span className="ml-1.5 rounded-md bg-warning-soft px-1.5 font-semibold text-warning" title={`${it.takenBy} took it for ${it.pocAtTime}'s student`}>
                            support for {it.pocAtTime}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">
                      L{it.level} · {coveredLabel(it.topics, it.subtopics)}
                    </td>
                    <td className="border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">
                      {it.questions.length}
                      {off ? <span className="ml-1.5 rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning">{off} off-roadmap</span> : null}
                      {codeRooms[it.id] ? (
                        <a href={`/room/${codeRooms[it.id]}`} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent-strong">
                          <Code2 aria-hidden="true" className="size-3.5" />
                          View code
                        </a>
                      ) : null}
                    </td>
                    <td className="border-b border-muted px-2.5 py-2.5">
                      <StatusPill tone={it.status === "Cleared" ? "accent" : it.status === "Need to Revisit" ? "warning" : "neutral"}>
                        {STATUS_LABEL[it.status]}
                      </StatusPill>
                    </td>
                    <td className="border-b border-muted py-2.5 pr-5 pl-2.5 font-semibold tabular">{it.rating} / 5</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState title="No interactions yet" description="Logged interactions will show here." />
        </div>
      )}
    </section>
  );
}
