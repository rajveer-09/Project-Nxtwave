/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { useState } from "react";
import { cn } from "@/common/lib/utils";
import { QuestionText } from "@/common/components/question-text";
import { cleanQuestions } from "@/common/lib/question-text";
import type { ExploreRound, ExploreStep, ExploreTopic, ProgressExplore } from "@/common/domain/progress-explore";

/**
 * DSA progress, explorable: pick a level to see its topics, a topic or subtopic to see its steps and
 * the interaction rounds that covered it. Opens on where the student is now.
 */

// One colour per meaning, distinct in light and dark: teal = cleared / reached, orange = in progress /
// current, grey = not yet. What you've clicked is the light blue highlight.
const LEVEL_BAR = { cleared: "bg-chart-4", current: "bg-warning-strong", future: "bg-muted" } as const;
const TOPIC_STATE = {
  cleared: ["✓ Cleared", "text-chart-4"],
  current: ["In progress", "text-warning"],
  covered: ["Rounds logged", "text-chart-4"],
  "not-started": ["Not started", "text-muted-foreground"],
} as const;
const SUB_STYLE = {
  done: "border border-chart-4/30 bg-chart-4/15 text-chart-4",
  now: "border border-warning-border bg-warning-soft text-warning",
  started: "border border-dashed border-chart-4/60 text-chart-4",
  todo: "border border-transparent bg-muted text-muted-foreground",
} as const;
const SELECTED = "ring-2 ring-primary";
const STATUS_TONE: Record<string, string> = { Cleared: "bg-chart-4/15 text-chart-4", "In progress": "bg-muted text-foreground" };

type Choice = { topic: string; subtopic: string | null };

/** Only what the student has started (cleared, current, or with rounds logged) can be opened. */
const started = (t: ExploreTopic) => t.state !== "not-started";
const subStarted = (state: string) => state !== "todo";

function Steps({ steps: given, note }: { steps: ExploreStep[]; note?: string | null }) {
  if (!given.length) return <p className="text-[13px] text-muted-foreground">This level has no steps; each topic is covered in one go.</p>;
  // Nothing reached yet: the first step (1.1) is where the student starts, so it's the one highlighted
  // (not when it's cleared without a recorded step: then nothing is guessed).
  const fresh = !note && given.every((s) => s.state === "todo" || s.state === "started");
  const steps = fresh ? given.map((s, i) => (i === 0 ? { ...s, state: "now" as const } : s)) : given;
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-1.5">
      {steps.map((step) => (
        <li
          key={step.code}
          className={cn(
            "flex min-w-16 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold",
            step.state === "done" && "border-chart-4/40 bg-chart-4/15 text-chart-4",
            step.state === "now" && "border-warning-border bg-warning-soft text-warning ring-1 ring-warning-strong",
            (step.state === "todo" || step.state === "started") && "border-border bg-card text-[#6B7080] dark:text-[#A3A9B7]",
          )}
        >
          <span className="text-[13px] font-bold">{step.code}</span>
          {step.label}
          <span className="sr-only">{step.state === "done" ? " (reached)" : step.state === "now" ? (fresh ? " (starts here)" : " (current step)") : " (not yet)"}</span>
        </li>
      ))}
    </ol>
  );
}

/** What the step colours mean. */
function StepLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="size-2.5 rounded-sm border border-chart-4/40 bg-chart-4/30" />
        Reached
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="size-2.5 rounded-sm border border-warning-strong bg-warning-soft" />
        Current / starts here
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="size-2.5 rounded-sm border border-border bg-card" />
        Not yet
      </span>
    </p>
  );
}

function Rounds({ rounds, item }: { rounds: ExploreRound[]; item: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rounds.length) return <p className="text-[13px] text-muted-foreground">No interaction rounds logged for this yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rounds.map((r) => {
        const expanded = open === r.id;
        const step = r.reached[item];
        return (
          <li key={r.id} className="rounded-lg border border-border">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
              className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-left text-[13px] hover:bg-surface-subtle"
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{r.date}</span>
                <span className="text-muted-foreground">
                  round {r.round} · {r.by}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {step ? <span className="rounded-md bg-surface-subtle px-1.5 py-px text-[11px] font-bold tabular">reached {step}</span> : null}
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[r.status] ?? "bg-warning-soft text-warning")}>{r.status}</span>
                <span className="text-xs font-bold tabular">{r.rating}/5</span>
              </span>
            </button>
            {expanded ? (
              <div className="border-t border-muted px-3 py-2">
                {r.questions.length ? (
                  <ol className="flex flex-col gap-1">
                    {cleanQuestions(r.questions).map((q, i) => (
                      <li key={`${q.title}-${i}`} className="flex items-start gap-2 text-[13px]">
                        <span className="w-4 shrink-0 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <QuestionText text={q.title} />
                        </span>
                        {q.tag ? <span className={cn("shrink-0 rounded-md px-1.5 py-px text-[11px] font-bold", q.tag === "Off-roadmap" ? "bg-warning-soft text-warning" : "bg-accent text-accent-strong")}>{q.tag}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No questions recorded for this round.</p>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function TopicCard({ t, pick, selected, onPick }: { t: ExploreTopic; pick: Choice; selected: boolean; onPick: (p: Choice) => void }) {
  const [label, tone] = TOPIC_STATE[t.state];
  if (!started(t)) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 opacity-70">
        <div className="flex justify-between gap-2">
          <span className="font-semibold">{t.name}</span>
          <span className={cn("text-xs font-bold", tone)}>{label}</span>
        </div>
        {t.subtopics.length ? (
          <ul className="flex flex-wrap gap-1">
            {t.subtopics.map((sub) => (
              <li key={sub.name} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", SUB_STYLE.todo)}>
                {sub.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors",
        selected ? "border-primary bg-accent/30 ring-1 ring-primary" : t.state === "current" ? "border-warning-border bg-warning-soft/50" : "border-border bg-card",
      )}
    >
      <button type="button" aria-pressed={selected && !pick.subtopic} onClick={() => onPick({ topic: t.name, subtopic: null })} className="flex w-full justify-between gap-2 text-left">
        <span className="font-semibold underline-offset-4 hover:underline">{t.name}</span>
        <span className={cn("text-xs font-bold", tone)}>{label}</span>
      </button>
      {t.subtopics.length ? (
        <ul className="flex flex-wrap gap-1">
          {t.subtopics.map((sub) => {
            const on = selected && pick.subtopic === sub.name;
            if (!subStarted(sub.state)) {
              return (
                <li key={sub.name} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", SUB_STYLE.todo)}>
                  {sub.name}
                  <span className="sr-only"> (not started)</span>
                </li>
              );
            }
            return (
              <li key={sub.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick({ topic: t.name, subtopic: sub.name })}
                  className={cn("rounded-md px-2 py-0.5 text-xs font-medium hover:ring-1 hover:ring-primary", SUB_STYLE[sub.state], on && SELECTED)}
                >
                  {sub.state === "done" ? <span aria-hidden="true">✓ </span> : null}
                  {sub.name}
                  {sub.state === "now" ? <span className="sr-only"> (current)</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ProgressExplorer({ data, history }: { data: ProgressExplore; history: React.ReactNode }) {
  const [level, setLevel] = useState(data.level);
  const lv = data.levels.find((l) => l.level === level) ?? data.levels[0];
  const startPick = (l: number): Choice => {
    const t = data.levels.find((x) => x.level === l)?.topics;
    if (l === data.level) return { topic: data.topic, subtopic: data.subtopic };
    return { topic: t?.find(started)?.name ?? "", subtopic: null };
  };
  // A level opens only once something in it has started (cleared, current, or rounds logged).
  const canOpen = (l: ProgressExplore["levels"][number]) => l.state !== "future" || data.rounds.some((r) => r.level === l.level);
  const [pick, setPick] = useState<Choice>(startPick(data.level));
  const choose = (l: number) => {
    setLevel(l);
    setPick(startPick(l));
  };

  const topic = lv?.topics.find((t) => t.name === pick.topic && started(t)) ?? lv?.topics.find(started);
  const sub = pick.subtopic ? topic?.subtopics.find((x) => x.name === pick.subtopic) : undefined;
  const steps = sub?.steps ?? topic?.steps ?? [];
  const item = sub?.name ?? topic?.name ?? "";
  const rounds = data.rounds.filter((r) => r.level === level && topic && r.topics.includes(topic.name) && (!sub || r.subtopics.includes(sub.name) || r.reached[sub.name] !== undefined));
  const isNow = level === data.level && topic?.name === data.topic && (sub ? sub.name === data.subtopic : !data.subtopic || !topic?.subtopics.length);

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Levels" className="grid grid-cols-4 gap-x-1.5 gap-y-3 sm:grid-cols-8">
        {data.levels.map((l) => {
          const inner = (
            <>
              <span className={cn("h-2.5 w-full rounded-full", LEVEL_BAR[l.state])} aria-hidden="true" />
              <span className={cn("text-xs font-bold", l.state === "future" ? "text-muted-foreground" : "text-foreground", l.level === level && "text-primary")}>L{l.level}</span>
              <span className="text-[11px] text-muted-foreground">{l.state === "cleared" ? "Cleared" : l.state === "current" ? "Current" : "Not started"}</span>
            </>
          );
          return (
            <li key={l.level}>
              {canOpen(l) ? (
                <button
                  type="button"
                  aria-pressed={l.level === level}
                  onClick={() => choose(l.level)}
                  title={l.title ? `L${l.level} · ${l.title}` : `Level ${l.level}`}
                  className={cn("flex w-full flex-col items-center gap-1.5 rounded-lg px-1 pt-1 pb-1.5 hover:bg-surface-subtle", l.level === level && "bg-surface-subtle")}
                >
                  {inner}
                </button>
              ) : (
                <div className="flex w-full flex-col items-center gap-1.5 px-1 pt-1 pb-1.5" title="Not started yet">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h3 className="text-[15px] font-bold">
            Level {level} topics{lv?.title ? <span className="font-medium text-muted-foreground"> · {lv.title}</span> : null}
          </h3>
          {lv?.topics.length ? (
            lv.topics.map((t) => <TopicCard key={t.name} t={t} pick={pick} selected={topic?.name === t.name} onPick={setPick} />)
          ) : (
            <p className="text-[13px] text-muted-foreground">No topics set for this level yet.</p>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          {topic ? (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="text-[15px] font-bold">
                  {isNow ? "Current: " : ""}
                  {topic.name}
                  {sub ? ` › ${sub.name}` : ""}
                </h3>
                <Steps steps={steps} note={sub ? sub.stepsNote : topic.stepsNote} />
                {(sub ? sub.stepsNote : topic.stepsNote) ? <p className="text-xs font-medium text-muted-foreground">{sub ? sub.stepsNote : topic.stepsNote}</p> : steps.length ? <StepLegend /> : null}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-[15px] font-bold">Interaction rounds{rounds.length ? ` · ${rounds.length}` : ""}</h3>
                <Rounds key={`${level}|${item}`} rounds={rounds} item={item} />
              </div>
            </>
          ) : null}
          {history}
        </div>
      </div>
    </div>
  );
}
