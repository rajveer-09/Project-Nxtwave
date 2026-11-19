/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { History, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { Skeleton } from "@/common/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/common/ui/tooltip";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import { studentHistoryAction, type HistoryEntry } from "../actions";

const button =
  "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

const TONE: Record<string, string> = { Cleared: "text-accent-strong", "Needs revisit": "text-warning" };

/**
 * Button text, shown only when the Students table has room (its wrapper is the @container,
 * see students-table.tsx). When it's narrow (e.g. sidebar open on a laptop) the buttons
 * are icon-only and the tooltip gives the name.
 */
const label = "hidden @[78rem]:inline";

/** History (interactions so far, in a pop-up) and Log interaction, at the end of a Students row. */
export function StudentRowActions({ niatId, name, logHref }: { niatId: string; name: string; logHref: string | null }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function show() {
    setOpen(true);
    if (entries) return;
    startLoading(async () => {
      const result = await studentHistoryAction(niatId);
      if (result.ok) setEntries(result.entries);
      else setError(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" className={button} onClick={show} aria-label={`Interaction history of ${name}`} />}
        >
          <History aria-hidden="true" className="size-3.5" />
          <span className={label}>History</span>
        </TooltipTrigger>
        <TooltipContent>History</TooltipContent>
      </Tooltip>
      {logHref ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Link href={logHref} className={cn(button, "border-primary/40 text-primary")} aria-label={`Log an interaction for ${name}`} />
            }
          >
            <NotebookPen aria-hidden="true" className="size-3.5" />
            <span className={label}>Log interaction</span>
          </TooltipTrigger>
          <TooltipContent>Log interaction</TooltipContent>
        </Tooltip>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto p-6 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{name} · interaction history</DialogTitle>
            <DialogDescription className="text-[13px] tabular">
              {niatId}
              {entries ? ` · ${entries.length} interaction${entries.length === 1 ? "" : "s"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {loading || (!entries && !error) ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="text-[13px] text-warning">{error}</p>
          ) : entries && entries.length ? (
            <ol className="flex flex-col gap-2.5">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-col gap-1.5 rounded-lg border border-border px-3.5 py-3 text-[13px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {formatDate(e.date)} · Round {e.round} · L{e.level}
                    </span>
                    <span className={cn("text-xs font-semibold", TONE[e.status] ?? "text-sidebar-foreground")}>
                      {e.status} · {e.rating}/5
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Taken by {e.takenBy}
                    {e.covered ? ` · ${e.covered}` : ""}
                  </span>
                  {e.questions.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {e.questions.map((q, i) => (
                        <li key={i} className={cn("rounded-md px-2 py-0.5 text-xs", q.offRoadmap ? "bg-warning-soft text-warning" : "bg-muted")}>
                          {q.step ? `${q.step} · ` : ""}
                          {q.title}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {e.remarks ? <p className="text-sidebar-foreground">{e.remarks}</p> : null}
                  {e.actionItems ? <p className="text-xs text-muted-foreground">Next: {e.actionItems}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No interactions yet" description="Logged interactions for this student will show here." />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
