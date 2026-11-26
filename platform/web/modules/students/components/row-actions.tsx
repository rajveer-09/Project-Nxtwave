/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { History, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { Skeleton } from "@/common/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/common/ui/tooltip";
import { cn } from "@/common/lib/utils";
import { studentHistoryAction, type HistoryEntry, type HistoryStudent } from "../actions";
import { InteractionTimeline, TimelineSubtitle } from "./interaction-timeline";

const button =
  "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Button text, shown only when the Students table has room (its wrapper is the @container,
 * see students-table.tsx). When it's narrow (e.g. sidebar open on a laptop) the buttons
 * are icon-only and the tooltip gives the name.
 */
const label = "hidden @[78rem]:inline";

/**
 * A row button with its name as a tooltip, shown only while the button is icon-only:
 * when its text is on screen the tooltip would just repeat it.
 */
function NamedButton({ name, icon, render }: { name: string; icon: React.ReactNode; render: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLSpanElement>(null);
  return (
    <Tooltip open={open} onOpenChange={(next) => setOpen(next && !!text.current && getComputedStyle(text.current).display === "none")}>
      <TooltipTrigger render={render}>
        {icon}
        <span ref={text} className={label}>
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

/** History (the interaction timeline, in a pop-up) and Log interaction, at the end of a Students or Today's interactions row. */
export function StudentRowActions({ niatId, name, logHref }: { niatId: string; name: string; logHref: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ student: HistoryStudent; entries: HistoryEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function show() {
    setOpen(true);
    if (data) return;
    startLoading(async () => {
      const result = await studentHistoryAction(niatId);
      if (result.ok) setData({ student: result.student, entries: result.entries });
      else setError(result.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <NamedButton
        name="History"
        icon={<History aria-hidden="true" className="size-3.5" />}
        render={<button type="button" className={button} onClick={show} aria-label={`Interaction history of ${name}`} />}
      />
      {logHref ? (
        <NamedButton
          name="Log interaction"
          icon={<NotebookPen aria-hidden="true" className="size-3.5" />}
          render={<Link href={logHref} className={cn(button, "border-primary/40 text-primary")} aria-label={`Log an interaction for ${name}`} />}
        />
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Header stays put; only the timeline below it scrolls. */}
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
              {name}
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground tabular">{niatId}</span>
            </DialogTitle>
            <DialogDescription>{data ? <TimelineSubtitle student={data.student} /> : "Interaction history"}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading || (!data && !error) ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-16 rounded-lg" />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <p className="text-[13px] text-warning">{error}</p>
            ) : data ? (
              <InteractionTimeline student={data.student} entries={data.entries} logHref={logHref} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
