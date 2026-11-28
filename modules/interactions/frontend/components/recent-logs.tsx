/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { IntentLink } from "@/common/components/intent-link";
import { EmptyState } from "@/common/components/empty-state";
import { formatDate } from "@/common/lib/dates";
import { coveredLabel, isSupport, STATUS_LABEL, type Interaction } from "@nxtone/interactions-ui/lib/types";
import { RecentLogsTable, type RecentRow } from "@nxtone/interactions-ui/components/recent-logs-table";

/** The fields the table shows (the rows go to the browser for paging; interactions can carry long transcripts). */
const toRow = (it: Interaction, codeRoom: string | null): RecentRow => ({
  id: it.id,
  date: formatDate(it.date),
  ymd: it.date,
  niatId: it.niatId,
  studentName: it.studentName,
  round: it.round,
  takenBy: it.takenBy,
  supportFor: isSupport(it) ? it.pocAtTime : null,
  covered: `Level ${it.level} · ${coveredLabel(it.topics, it.subtopics)}`,
  questions: it.questions.length,
  offRoadmap: it.questions.filter((q) => q.offRoadmap).length,
  status: STATUS_LABEL[it.status],
  tone: it.status === "Cleared" ? "accent" : it.status === "Need to Revisit" ? "danger" : "neutral",
  rating: it.rating,
  codeRoom,
});

/** `codeRooms`: interaction id → code room saved with it (shows a "Code" link). */
/** `allHref`: where to see every row when only the first ones are listed (Today's interactions with the same filters). */
/** `actions`: per interaction id, the control at the end of its row (e.g. the page's Inspect button). */
export function RecentLogs({ rows, total, exportHref, allHref, codeRooms = {}, actions = {}, linkStudents = false }: { rows: Interaction[]; total: number; exportHref: string; allHref?: string; codeRooms?: Record<string, string>; actions?: Record<string, React.ReactNode>; linkStudents?: boolean }) {
  return (
    <section aria-labelledby="recent-h" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-4">
        <div className="flex flex-col">
          <h2 id="recent-h" className="text-base font-semibold">
            Recent interactions
          </h2>
          <span className="text-xs text-muted-foreground">
            {rows.length < total ? `Latest ${rows.length} of ${total.toLocaleString("en-IN")}` : `${total.toLocaleString("en-IN")} ${total === 1 ? "interaction" : "interactions"}`}
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
        <RecentLogsTable rows={rows.map((it) => toRow(it, codeRooms[it.id] ?? null))} actions={actions} linkStudents={linkStudents} />
      ) : (
        <div className="p-5">
          <EmptyState title="No interactions yet" description="Logged interactions will show here." />
        </div>
      )}
    </section>
  );
}
