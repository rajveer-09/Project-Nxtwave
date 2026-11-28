/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import {
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  ListChecks,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/common/lib/utils";
import { Pager, usePages } from "@/common/components/pager";
import { QuestionText } from "@/common/components/question-text";
import { cleanNote, cleanQuestions } from "@/common/lib/question-text";

export type InteractionItem = {
  id: string;
  date: string;
  round: number;
  by: string;
  level: string;
  topics: string;
  status: string;
  rating: number;
  questions: string;
  stepsReached: string;
  performedWell: string;
  improvementAreas: string;
  actionItems: string;
  transcriptWords: number;
  /** The questions as a list (step code or "Off-roadmap" as the tag), when known. */
  questionList?: { title: string; tag: string }[];
  /** Steps reached as [step, result] pairs, when known. */
  stepList?: [string, string][];
  /** Code room saved with this interaction, if any. */
  codeRoom?: string;
};

const TONE: Record<string, { rail: string; pill: string }> = {
  Cleared: { rail: "bg-primary", pill: "bg-accent text-accent-strong" },
  "In progress": { rail: "bg-chart-4", pill: "bg-muted text-foreground" },
};
const tone = (status: string) =>
  TONE[status] ?? {
    rail: "bg-destructive",
    pill: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  };

const empty = (v: string) => !v.trim() || v.trim() === "—";

/** "Two Sum (2.1), Trapping Rain Water (off-roadmap)" → items, for rounds without a question list. */
function questionsOf(it: InteractionItem) {
  return cleanQuestions(rawQuestions(it));
}

function rawQuestions(it: InteractionItem) {
  if (it.questionList?.length) return it.questionList;
  if (empty(it.questions)) return [];
  return it.questions.split(/,\s*(?![^()]*\))/).map((q) => {
    const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(q.trim());
    return m
      ? { title: m[1], tag: /off-roadmap/i.test(m[2]) ? "Off-roadmap" : m[2] }
      : { title: q.trim(), tag: "" };
  });
}

function stepsOf(it: InteractionItem): [string, string][] {
  if (it.stepList?.length) return it.stepList;
  if (empty(it.stepsReached)) return [];
  return it.stepsReached.split(/,\s*/).map((s) => {
    const [k, ...v] = s.split(":");
    return [k.trim(), v.join(":").trim()] as [string, string];
  });
}

/** The rating as five dots, with the number for screen readers and at a glance. */
function Rating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1.5" title={`Rating ${value} of 5`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "size-1.5 rounded-full",
              n <= value ? "bg-foreground" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </span>
      <span className="text-[13px] font-bold tabular">
        {value}
        <span className="font-medium text-muted-foreground">/5</span>
        <span className="sr-only"> rating</span>
      </span>
    </span>
  );
}

function Notes({
  icon: Icon,
  title,
  text,
  className,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
  className?: string;
}) {
  // Nothing noted: a quiet box, not a coloured one.
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3.5 py-3",
        empty(text)
          ? "border-border bg-card [&>span]:text-muted-foreground"
          : className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold">
        <Icon aria-hidden="true" className="size-3.5" />
        {title}
      </span>
      <p className="text-[13px] leading-relaxed whitespace-pre-line text-foreground">
        {empty(text) ? (
          <span className="text-muted-foreground">Nothing noted.</span>
        ) : (
          cleanNote(text)
        )}
      </p>
    </div>
  );
}

/**
 * Interaction rounds, newest first, all collapsed: the summary row shows when, who, what was
 * covered, the outcome and the rating; opening one (only one at a time) shows the questions, steps
 * reached, feedback and links.
 */
const PAGE = 5;

export function InteractionsList({
  items,
  student = false,
}: {
  items: InteractionItem[];
  student?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // Five rounds a page, latest first; ‹ › move between pages (closing the open one).
  const pg = usePages(items, PAGE, () => setOpen(null));
  if (!items.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
        No interactions logged yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {pg.items.map((it) => {
          const expanded = open === it.id;
          const panelId = `interaction-${it.id}`;
          const t = tone(it.status);
          const questions = questionsOf(it);
          const steps = stepsOf(it);
          return (
            <li
              key={it.id}
              className={cn(
                "relative overflow-hidden rounded-xl border bg-card transition-shadow",
                expanded ? "border-input shadow-sm" : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className={cn("absolute inset-y-0 left-0 w-1", t.rail)}
              />
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : it.id)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 py-3 pr-4 pl-5 text-left hover:bg-surface-subtle sm:pr-5"
              >
                <span className="flex size-10 flex-col items-center justify-center rounded-lg bg-surface-subtle leading-none">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Rd
                  </span>
                  <span className="text-[15px] font-bold tabular">
                    {it.round}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{it.date}</span>
                    <span className="text-[13px] text-muted-foreground">
                      by {it.by}
                    </span>
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {it.level}
                    </span>{" "}
                    · {it.topics}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline",
                      t.pill,
                    )}
                  >
                    {it.status}
                  </span>
                  <Rating value={it.rating} />
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "col-start-2 w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:hidden",
                    t.pill,
                  )}
                >
                  {it.status}
                </span>
              </button>

              {expanded ? (
                <div
                  id={panelId}
                  className="flex flex-col gap-4 border-t border-muted py-4 pr-4 pl-5 sm:pr-5"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="flex flex-col gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <ListChecks aria-hidden="true" className="size-3.5" />
                        Questions asked
                        {questions.length ? ` · ${questions.length}` : ""}
                      </h4>
                      {questions.length ? (
                        <ol className="flex flex-col divide-y divide-muted rounded-lg border border-border">
                          {questions.map((q, i) => (
                            <li
                              key={`${q.title}-${i}`}
                              className="flex items-start gap-2.5 px-3 py-2 text-[13px]"
                            >
                              <span className="mt-px w-4 shrink-0 text-right text-xs text-muted-foreground tabular">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1 font-medium">
                                <QuestionText text={q.title} />
                              </span>
                              {q.tag ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded-md px-1.5 py-px text-[11px] font-bold",
                                    q.tag === "Off-roadmap"
                                      ? "bg-warning-soft text-warning"
                                      : "bg-accent text-accent-strong",
                                  )}
                                >
                                  {q.tag}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">
                          No questions recorded.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <Target aria-hidden="true" className="size-3.5" />
                        Steps reached
                      </h4>
                      {steps.length ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {steps.map(([step, result]) => (
                            <li
                              key={step}
                              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1 text-xs"
                            >
                              <span className="font-bold tabular">{step}</span>
                              {result ? (
                                <span className="text-muted-foreground">
                                  {result}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">
                          Not recorded.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Notes
                      icon={CheckCircle2}
                      title="Performed well"
                      text={it.performedWell}
                      className="border-accent bg-accent/40 [&>span]:text-accent-strong"
                    />
                    <Notes
                      icon={Sparkles}
                      title="Improvement areas"
                      text={it.improvementAreas}
                      className="border-warning-border bg-warning-soft/60 [&>span]:text-warning"
                    />
                    <Notes
                      icon={ListChecks}
                      title="Action items"
                      text={it.actionItems}
                      className="border-border bg-surface-subtle [&>span]:text-foreground"
                    />
                  </div>

                  {it.codeRoom || !student ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-muted pt-3 text-[13px]">
                      {it.codeRoom ? (
                        <a
                          href={`/room/${it.codeRoom}`}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1.5 font-semibold text-primary hover:text-accent-strong"
                        >
                          <Code2 aria-hidden="true" className="size-4" />
                          View code written
                        </a>
                      ) : null}
                      {student ? null : (
                        <span className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                          <FileText aria-hidden="true" className="size-4" />
                          <span className="text-primary">Recording</span>·
                          <span className="text-primary">Transcript link</span>
                          {it.transcriptWords ? (
                            <>
                              ·
                              <span className="text-primary">
                                Pasted transcript (
                                {it.transcriptWords.toLocaleString("en-IN")}{" "}
                                words)
                              </span>
                            </>
                          ) : null}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Pager {...pg} label="Interaction pages" prevLabel="Newer rounds" nextLabel="Older rounds" className="pt-1" />
    </div>
  );
}
