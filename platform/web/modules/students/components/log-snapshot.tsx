/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import { StatusPill } from "@/common/components/chips";
import { LeetCodeLink } from "@/common/components/leetcode-link";
import type { RosterStudent } from "@/common/sample-data/roster";
import { formatDate } from "@/common/lib/dates";
import { cleanNote } from "@/common/lib/question-text";
import { cn } from "@/common/lib/utils";
import { coveredLabel, isSupport, STATUS_LABEL, type Interaction } from "@nxtone/interactions-ui/lib/types";
import { InteractionInspect } from "./interaction-inspect";
import { StudentRowActions } from "./row-actions";

/**
 * Log interaction: before the form, where the student stands (a row of stats) and their last
 * interaction, with Inspect for its full record and History for every interaction, newest first.
 * Shown for any student being logged (their own instructor, or someone covering).
 */

const ago = (days: number | null) => (days === null ? "never" : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);
const tone = (status: Interaction["status"]) => (status === "Cleared" ? "accent" : status === "Need to Revisit" ? "warning" : "neutral");

function Tile({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("truncate text-[17px] font-semibold", warn && "text-warning")}>{value}</span>
      {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

export function LogSnapshot({ student: s, latestTest, interactions }: { student: RosterStudent; latestTest: number | null; interactions: Interaction[] }) {
  const last = interactions[0];
  const where = [s.topic, s.subtopic].filter(Boolean).join(" › ");
  return (
    <section aria-label={`${s.name} at a glance`} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Tile label="Level" value={`L${s.level}`} sub={where || "—"} />
        <Tile label="Attendance · 30 days" value={s.attendance30d === null ? "—" : `${s.attendance30d}%`} warn={s.attendance30d !== null && s.attendance30d < 75} sub={`${s.college} · ${s.section}`} />
        <Tile label="Interactions" value={interactions.length} sub={`last ${ago(s.lastInteractionDays)}`} warn={s.lastInteractionDays === null || s.lastInteractionDays >= 14} />
        <Tile label="Last outcome" value={last ? STATUS_LABEL[last.status] : "—"} sub={last ? `rating ${last.rating} / 5` : "no interaction yet"} warn={last?.status === "Need to Revisit"} />
        <Tile label="Weekly test" value={latestTest === null ? "—" : `${latestTest}`} sub={latestTest === null ? "no result yet" : "latest total"} />
        <Tile
          label="LeetCode contests"
          value={s.contestsAttended}
          sub={s.lcHandle ? <LeetCodeLink handle={s.lcHandle} className="text-xs" /> : "no handle"}
          warn={s.risk.contestAbsentStreak >= 3}
        />
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Last interaction</h2>
          {/* History: every interaction, newest first (in a pop-up). */}
          {interactions.length ? <StudentRowActions niatId={s.niatId} name={s.name} logHref={null} /> : null}
        </div>
        {last ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b>{formatDate(last.date)}</b>
                <span className="text-muted-foreground">
                  round {last.round} · {last.takenBy}
                </span>
                {isSupport(last) ? <span className="rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning">support</span> : null}
                <StatusPill tone={tone(last.status)}>{STATUS_LABEL[last.status]}</StatusPill>
                <span className="font-semibold tabular">{last.rating} / 5</span>
              </span>
              <span className="text-muted-foreground">
                L{last.level} · {coveredLabel(last.topics, last.subtopics)}
              </span>
              {last.actionItems.trim() ? (
                <span className="line-clamp-2">
                  <b className="font-semibold">Action items:</b> {cleanNote(last.actionItems)}
                </span>
              ) : null}
              {last.improvementAreas.trim() ? (
                <span className="line-clamp-2 text-muted-foreground">
                  <b className="font-semibold text-foreground">To improve:</b> {cleanNote(last.improvementAreas)}
                </span>
              ) : null}
            </div>
            <InteractionInspect niatId={s.niatId} interactionId={last.id} studentName={s.name} />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No interaction logged yet. This will be the first.</p>
        )}
      </div>
    </section>
  );
}
