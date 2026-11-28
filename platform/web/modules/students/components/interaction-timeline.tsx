"use client";

import { ChevronDown, CircleHelp, Code2, ListChecks, MessageSquareText, NotebookPen, PencilLine, ThumbsUp, TrendingUp, UserRound, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import type { HistoryEntry, HistoryStudent } from "../actions";

const dateField =
  "h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

const tone = (statusKey: string) => (statusKey === "Cleared" ? "accent" : statusKey === "Need to Revisit" ? "danger" : "neutral");

/** Header line under the student's name: class, hall and current instructor. */
export function TimelineSubtitle({ student }: { student: HistoryStudent }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span>
        {student.college} · {student.section}
      </span>
      {student.hall ? <span>· {student.hall}</span> : null}
      <span>
        · Instructor: <b className="font-semibold text-foreground">{student.instructor || "Unassigned"}</b>
      </span>
    </span>
  );
}

/**
 * A student's interactions as a numbered timeline, newest first: a summary (level, count, last
 * interaction, average rating), an optional date filter, and one card per interaction that opens to
 * show everything logged. Read-only; editing comes later.
 */
export function InteractionTimeline({ student, entries, logHref }: { student: HistoryStudent; entries: HistoryEntry[]; logHref: string | null }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Which cards are open: all start collapsed; Expand all opens them.
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const shown = entries.filter((e) => (!from || e.date >= from) && (!to || e.date <= to));
  const allOpen = shown.length > 0 && shown.every((e) => open.has(e.id));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const avg = entries.length ? Math.round((entries.reduce((n, e) => n + e.rating, 0) / entries.length) * 10) / 10 : null;
  const stats = [
    ["Current level", `Level ${student.level}`],
    ["Interactions", entries.length.toLocaleString("en-IN")],
    ["Last interaction", entries[0] ? formatDate(entries[0].date) : "—"],
    ["Average rating", avg === null ? "—" : `${avg} / 5`],
  ];

  return (
    <div className="flex flex-col gap-4">
      {logHref ? (
        <Link
          href={logHref}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-3 text-xs font-semibold text-primary hover:bg-muted"
        >
          <NotebookPen aria-hidden="true" className="size-3.5" />
          Log interaction
        </Link>
      ) : null}

      {/* gap-px over a border-coloured background draws the lines between the tiles at any width */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-2.5">
            <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2">
        <span className="text-xs text-muted-foreground">Pick dates to see the interactions taken in that period.</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateField} />
          </label>
          <label className="flex items-center gap-1.5">
            to
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateField} />
          </label>
          {from || to ? (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="ml-1 font-semibold text-primary hover:text-accent-strong"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {shown.length ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {from || to ? `${shown.length} of ${entries.length} interactions in these dates` : `${entries.length} interaction${entries.length === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((e) => e.id)))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-input bg-card px-2 text-xs font-semibold hover:bg-muted"
            >
              <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", allOpen && "rotate-180")} />
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <ol className="relative flex flex-col gap-3">
            {/* The timeline's vertical line, behind the round numbers */}
            <span aria-hidden="true" className="absolute top-4 bottom-4 left-[13px] w-px bg-border" />
            {shown.map((e) => {
              const expanded = open.has(e.id);
              const panelId = `timeline-${e.id}`;
              const latest = e.id === entries[0]?.id;
              return (
                <li key={e.id} className="relative flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative z-10 mt-3 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular",
                      latest ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {e.number}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggle(e.id)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-subtle"
                    >
                      <ChevronDown aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold">Interaction {e.number}</span>
                          {latest ? <span className="rounded bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">Latest</span> : null}
                          <StatusPill tone={tone(e.statusKey)}>{e.status}</StatusPill>
                        </span>
                        <span className="text-[13px] font-semibold">
                          Level {e.level} · {e.covered || "—"}
                          {e.steps ? <span className="font-normal text-muted-foreground"> ({e.steps})</span> : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(e.date)} · Taken by <span className="text-foreground">{e.takenBy}</span>
                          {e.support ? (
                            <span className="ml-1.5 rounded-md bg-warning-soft px-1.5 font-semibold text-warning">support for {e.poc}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-center rounded-md border border-border px-2 py-1">
                        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Rating</span>
                        <span className="text-sm font-bold tabular">
                          {e.rating}
                          <span className="text-xs font-normal text-muted-foreground">/5</span>
                        </span>
                      </span>
                    </button>
                    {expanded ? <Details entry={e} id={panelId} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <EmptyState
          title={entries.length ? "No interactions in these dates" : "No interactions yet"}
          description={entries.length ? "Pick other dates or clear them." : "Logged interactions for this student will show here."}
        />
      )}
    </div>
  );
}

/**
 * Questions as written, one per line (headings like "Easy standard:-" stay lines of their own).
 * Lines that are just a link become clickable; off-roadmap questions are marked.
 */
export function QuestionLines({ questions, className }: { questions: HistoryEntry["questions"]; className?: string }) {
  if (!questions.length) return <p className={cn("text-[13px] text-muted-foreground", className)}>—</p>;
  return (
    <ol className={cn("flex flex-col gap-0.5 rounded-md bg-surface-subtle px-3 py-2 font-mono text-xs leading-relaxed break-words", className)}>
      {questions.map((q, i) => (
        <li key={i}>
          {q.step ? <span className="text-muted-foreground">{q.step} · </span> : null}
          {q.title.split(/(https?:\/\/\S+)/).map((part, j) =>
            /^https?:\/\//.test(part) ? (
              <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                {part}
              </a>
            ) : (
              part
            ),
          )}
          {q.offRoadmap ? <span className="ml-1.5 rounded bg-warning-soft px-1 font-sans font-semibold text-warning">off-roadmap</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Feedback sections, each its own box; the stripe and tint say at a glance what kind of note it is. */
const NOTES: { key: "remarks" | "performedWell" | "improvementAreas" | "actionItems" | "tweakedQuestions"; label: string; icon: typeof MessageSquareText; box: string; iconClass: string }[] = [
  { key: "performedWell", label: "Performed well", icon: ThumbsUp, box: "border-l-emerald-500 bg-emerald-500/5", iconClass: "text-emerald-600 dark:text-emerald-400" },
  { key: "improvementAreas", label: "Improvement areas", icon: TrendingUp, box: "border-l-warning bg-warning-soft/40", iconClass: "text-warning" },
  { key: "actionItems", label: "Action items", icon: ListChecks, box: "border-l-primary bg-primary/5", iconClass: "text-primary" },
  { key: "remarks", label: "Remarks", icon: MessageSquareText, box: "border-l-border bg-surface-subtle", iconClass: "text-muted-foreground" },
  { key: "tweakedQuestions", label: "Tweaked questions", icon: PencilLine, box: "border-l-border bg-surface-subtle", iconClass: "text-muted-foreground" },
];

function Details({ entry: e, id }: { entry: HistoryEntry; id: string }) {
  const notes = NOTES.filter((n) => e[n.key].trim());
  return (
    <div id={id} className="flex flex-col gap-3 border-t border-muted bg-surface-subtle/40 px-3 pt-3 pb-3.5 text-[13px]">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <h4 className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-bold">
          <CircleHelp aria-hidden="true" className="size-3.5 text-primary" />
          Questions asked
          <span className="rounded bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground tabular">{e.questions.length}</span>
        </h4>
        <QuestionLines questions={e.questions} className="m-2.5" />
      </section>

      {notes.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map(({ key, label, icon: Icon, box, iconClass }) => (
            <section key={key} className={cn("rounded-lg border border-l-4 border-border px-3 py-2.5", box, key === "remarks" || key === "tweakedQuestions" ? "sm:col-span-2" : "")}>
              <h4 className="flex items-center gap-1.5 text-xs font-bold">
                <Icon aria-hidden="true" className={cn("size-3.5", iconClass)} />
                {label}
              </h4>
              <p className="mt-1 leading-relaxed whitespace-pre-line text-foreground/90">{e[key]}</p>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">No remarks or feedback were written for this interaction.</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-muted-foreground">
          <UserRound aria-hidden="true" className="size-3.5" />
          POC at the time: <span className="font-semibold text-foreground">{e.poc || "—"}</span>
        </span>
        {e.meetRecording ? (
          <a href={e.meetRecording} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-semibold text-primary hover:bg-muted">
            <Video aria-hidden="true" className="size-3.5" />
            Recording
          </a>
        ) : null}
        {e.codeRoom ? (
          <a href={`/room/${e.codeRoom}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-semibold text-primary hover:bg-muted">
            <Code2 aria-hidden="true" className="size-3.5" />
            View code
          </a>
        ) : null}
      </div>
    </div>
  );
}
