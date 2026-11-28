"use client";

import { Code2, Eye, FileText, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusPill } from "@/common/components/chips";
import { formatDate } from "@/common/lib/dates";
import { cleanNote } from "@/common/lib/question-text";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { Skeleton } from "@/common/ui/skeleton";
import { interactionRecordAction, type HistoryEntry } from "../actions";
import { openInteractionLog, type InteractionLogView } from "@nxtone/interactions-ui/actions";
import { InteractionEditForm } from "@nxtone/interactions-ui/components/interaction-edit-form";
import { QuestionLines } from "./interaction-timeline";

const tone = (statusKey: string) => (statusKey === "Cleared" ? "accent" : statusKey === "Need to Revisit" ? "danger" : "neutral");
const box = "rounded-lg border border-border px-3.5 py-2.5";
const label = "text-xs font-semibold text-muted-foreground";

/**
 * "Inspect" on an interactions row (Today's interactions, Log interaction, Recent interactions): that
 * one interaction's full record in a pop-up (loaded on click: for whoever may see the student, or the
 * person who took it). Admins, who took it and the student's instructor also get Edit.
 */
export function InteractionInspect({ niatId, interactionId, studentName }: { niatId: string; interactionId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [editable, setEditable] = useState<InteractionLogView | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  function load() {
    startLoading(async () => {
      const [result, log] = await Promise.all([interactionRecordAction(niatId, interactionId), openInteractionLog(interactionId)]);
      if (result.ok) setEntry(result.entry);
      else setError(result.error);
      setEditable(log.ok && log.view.canEdit ? log.view : null);
    });
  }

  function show() {
    setOpen(true);
    setEditing(false);
    if (!entry) load();
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
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(false);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="gap-1 border-b border-border px-6 pt-5 pb-4 pr-12">
            <DialogTitle className="text-lg">{editing ? "Edit interaction" : "Interaction evaluation record"}</DialogTitle>
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
            ) : editing && editable ? (
              <InteractionEditForm
                v={editable}
                onCancel={() => setEditing(false)}
                onDone={() => {
                  setEditing(false);
                  setEntry(null);
                  load();
                  router.refresh();
                }}
              />
            ) : entry ? (
              <Record entry={entry} />
            ) : null}
          </div>
          <DialogFooter className="border-t border-border px-6 py-3">
            {editable && entry && !editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-4 text-sm font-semibold hover:bg-muted"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
                Edit
              </button>
            ) : null}
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
              <dd className="mt-1 whitespace-pre-line">{cleanNote(value)}</dd>
            </div>
          ))}
      </dl>
      <Transcript link={e.transcriptLink} text={e.transcriptText} />
      {e.meetRecording || e.codeRoom ? (
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          {e.meetRecording ? (
            <a href={e.meetRecording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-accent-strong">
              <FileText aria-hidden="true" className="size-3.5" />
              Transcript link
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

/** The transcript: its link, and the pasted text (the start, then all of it on "Show full transcript"). */
function Transcript({ link, text }: { link?: string; text?: string }) {
  const [full, setFull] = useState(false);
  if (!link && !text) {
    return (
      <div className={box}>
        <p className={label}>Transcript</p>
        <p className="mt-1 text-muted-foreground">No transcript saved.</p>
      </div>
    );
  }
  const words = text ? text.split(/\s+/).length : 0;
  const long = !!text && text.length > 600;
  return (
    <div className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={label}>Transcript{words ? ` · ${words.toLocaleString("en-IN")} words` : ""}</p>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent-strong">
            <FileText aria-hidden="true" className="size-3.5" />
            Open transcript link
          </a>
        ) : null}
      </div>
      {text ? (
        <>
          <p className={`mt-1.5 whitespace-pre-line leading-relaxed ${full ? "max-h-[50vh] overflow-y-auto pr-1" : ""}`}>{full || !long ? text : `${text.slice(0, 600).trimEnd()}…`}</p>
          {long ? (
            <button type="button" onClick={() => setFull((x) => !x)} aria-expanded={full} className="mt-1.5 text-xs font-semibold text-primary hover:text-accent-strong">
              {full ? "Show less" : "Show full transcript"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
