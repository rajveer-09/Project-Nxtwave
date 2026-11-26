"use client";

import { Code2, Eye, Video } from "lucide-react";
import { useState, useTransition } from "react";
import { StatusPill } from "@/common/components/chips";
import { formatDate } from "@/common/lib/dates";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { Skeleton } from "@/common/ui/skeleton";
import { interactionRecordAction, type HistoryEntry } from "../actions";
import { QuestionLines } from "./interaction-timeline";

const tone = (statusKey: string) => (statusKey === "Cleared" ? "accent" : statusKey === "Need to Revisit" ? "warning" : "neutral");
const box = "rounded-lg border border-border px-3.5 py-2.5";
const label = "text-xs font-semibold text-muted-foreground";

/**
 * "Inspect" on a Today's interactions row: that one interaction's full record in a pop-up (loaded
 * on click: for whoever may see the student, or the person who took it). Read-only for now.
 */
export function InteractionInspect({ niatId, interactionId, studentName }: { niatId: string; interactionId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function show() {
    setOpen(true);
    if (entry) return;
    startLoading(async () => {
      const result = await interactionRecordAction(niatId, interactionId);
      if (result.ok) setEntry(result.entry);
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={`Inspect this interaction with ${studentName}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold whitespace-nowrap hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye aria-hidden="true" className="size-3.5" />
        Inspect
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
            <DialogTitle className="text-lg">Interaction evaluation record</DialogTitle>
            <DialogDescription className="text-[13px]">
              Candidate: <b className="font-semibold text-foreground">{studentName}</b> <span className="tabular">({niatId})</span>
              {entry ? ` · Interaction ${entry.number} · ${formatDate(entry.date)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading || (!entry && !error) ? (
              <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <p className="text-[13px] text-warning">{error}</p>
            ) : entry ? (
              <Record entry={entry} />
            ) : null}
          </div>
          <DialogFooter className="border-t border-border px-6 py-3">
            <DialogClose className="inline-flex h-9 items-center rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted">Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Record({ entry: e }: { entry: HistoryEntry }) {
  const tiles: [string, React.ReactNode][] = [
    ["Assigned instructor (POC)", e.poc || "—"],
    [
      "Interaction taken by",
      <>
        {e.takenBy}
        {e.support ? <span className="ml-1.5 rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning">support</span> : null}
      </>,
    ],
    ["Interaction date", formatDate(e.date)],
    ["Status", <StatusPill key="s" tone={tone(e.statusKey)}>{e.status}</StatusPill>],
    ["Rating", `${e.rating} / 5`],
    ["Level · subtopic & step", [`Level ${e.level}`, e.subtopics.join(", "), e.steps].filter(Boolean).join(" · ")],
  ];
  const blocks: [string, string][] = [
    ["Topics", e.topics.join(", ")],
    ["Subtopics", e.subtopics.join(", ")],
    ["Steps reached", e.stepsDetail],
  ];
  const notes: [string, string][] = [
    ["Tweaked questions", e.tweakedQuestions],
    ["Remarks", e.remarks],
    ["Performed well", e.performedWell],
    ["Improvement areas", e.improvementAreas],
    ["Action items", e.actionItems],
  ];
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <dl className="grid gap-3 sm:grid-cols-3">
        {tiles.map(([name, value]) => (
          <div key={name} className={box}>
            <dt className={label}>{name}</dt>
            <dd className="mt-1 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <dl className="flex flex-col gap-3">
        {blocks.map(([name, value]) => (
          <div key={name} className={box}>
            <dt className={label}>{name}</dt>
            <dd className="mt-1">{value || "—"}</dd>
          </div>
        ))}
        <div className={box}>
          <dt className={label}>Questions asked</dt>
          <dd>
            <QuestionLines questions={e.questions} className="mt-1.5" />
          </dd>
        </div>
        {notes
          .filter(([, value]) => value.trim())
          .map(([name, value]) => (
            <div key={name} className={box}>
              <dt className={label}>{name}</dt>
              <dd className="mt-1 whitespace-pre-line">{value}</dd>
            </div>
          ))}
      </dl>
      {e.meetRecording || e.codeRoom ? (
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          {e.meetRecording ? (
            <a href={e.meetRecording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-accent-strong">
              <Video aria-hidden="true" className="size-3.5" />
              Meet recording
            </a>
          ) : null}
          {e.codeRoom ? (
            <a href={`/room/${e.codeRoom}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:text-accent-strong">
              <Code2 aria-hidden="true" className="size-3.5" />
              View code
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
