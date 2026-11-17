/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { addQuestionAction, archiveQuestionAction, decideAction, undoDecisionAction, type ActionResult } from "../actions";
import type { Question, QueueItem } from "../data";

export type RoadmapLevel = {
  level: number;
  name: string;
  topics: { topic: string; subtopics: string[]; steps: { code: string; label: string }[] }[];
};

const input =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function Chip({ on, onClick, children, tone = "dark" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "dark" | "accent" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 text-[13px] font-semibold",
        on ? (tone === "dark" ? "border-foreground bg-foreground text-background" : "border-accent-border bg-accent text-accent-foreground") : "border-input bg-card text-sidebar-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        after?.();
        router.refresh();
      } else toast.error(result.error);
    });
  return { pending, run };
}

export function CurriculumAdmin({ roadmap, questions, queue }: { roadmap: RoadmapLevel[]; questions: Question[]; queue: QueueItem[] }) {
  const [tab, setTab] = useState<"roadmap" | "review">("roadmap");
  const toReview = queue.filter((q) => !q.decision).length;
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Curriculum sections" className="flex flex-wrap gap-1 border-b border-border">
        {[
          ["roadmap", "Roadmap", null],
          ["review", "Off-roadmap questions", toReview],
        ].map(([key, label, count]) => (
          <button
            key={key as string}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key as "roadmap" | "review")}
            className={cn("-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3.5 text-sm font-semibold", tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label}
            {count ? <StatusPill tone="warning">{count} to review</StatusPill> : null}
          </button>
        ))}
      </div>
      {tab === "roadmap" ? <RoadmapEditor roadmap={roadmap} questions={questions} /> : <ReviewQueue roadmap={roadmap} queue={queue} />}
    </div>
  );
}

function RoadmapEditor({ roadmap, questions }: { roadmap: RoadmapLevel[]; questions: Question[] }) {
  const { pending, run } = useAction();
  const [level, setLevel] = useState(1);
  const lvl = roadmap[level];
  const [topic, setTopic] = useState(lvl.topics[0]?.topic ?? "");
  const t = lvl.topics.find((x) => x.topic === topic) ?? lvl.topics[0];
  const [subtopic, setSubtopic] = useState<string | null>(t?.subtopics[0] ?? null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", source: "", url: "", notes: "" });

  const here = questions.filter((q) => q.level === level && q.topic === t?.topic && q.subtopic === (t?.subtopics.length ? subtopic : null));
  const live = here.filter((q) => !q.archived);
  const archived = here.filter((q) => q.archived);
  const path = `${lvl.name} › ${t?.topic ?? ""}${t?.subtopics.length && subtopic ? ` › ${subtopic}` : ""}`;

  function pickLevel(n: number) {
    setLevel(n);
    const first = roadmap[n].topics[0];
    setTopic(first?.topic ?? "");
    setSubtopic(first?.subtopics[0] ?? null);
    setAdding(null);
  }
  function pickTopic(name: string) {
    setTopic(name);
    setSubtopic(lvl.topics.find((x) => x.topic === name)?.subtopics[0] ?? null);
    setAdding(null);
  }
  function add(step: string) {
    run(
      () =>
        addQuestionAction({
          level,
          topic: t.topic,
          subtopic: t.subtopics.length ? subtopic : null,
          step,
          title: draft.title,
          source: draft.source,
          url: draft.url,
          notes: draft.notes,
          tweakOf: null,
        }),
      () => {
        setAdding(null);
        setDraft({ title: "", source: "", url: "", notes: "" });
      },
    );
  }

  const steps = t?.steps.length ? t.steps : [{ code: "", label: "Questions" }];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <nav aria-label="Levels" className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 rounded-xl border border-border bg-card p-3">
        {roadmap.map((l) => {
          const count = questions.filter((q) => q.level === l.level && !q.archived).length;
          const on = l.level === level;
          return (
            <button
              key={l.level}
              type="button"
              aria-pressed={on}
              onClick={() => pickLevel(l.level)}
              className={cn("flex min-h-12 items-center gap-3 rounded-lg border px-3 text-left", on ? "border-accent-border bg-accent" : "border-transparent hover:bg-muted")}
            >
              <span className={cn("flex size-8 items-center justify-center rounded-lg font-heading text-[13px] font-bold", on ? "bg-primary text-primary-foreground" : "bg-muted")}>L{l.level}</span>
              <span className="flex flex-col">
                <span className="font-semibold">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  {l.topics.length} topics · {count} questions
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <section aria-label="Topics" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{lvl.name} · topics</h2>
            <span className="text-xs text-muted-foreground">Topics and subtopics come from the roadmap; editing them is a later step.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lvl.topics.map((x) => (
              <Chip key={x.topic} on={x.topic === t?.topic} onClick={() => pickTopic(x.topic)}>
                {x.topic}
              </Chip>
            ))}
          </div>
          {t?.subtopics.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-muted pt-3">
              <span className="mr-1 text-xs font-bold text-muted-foreground uppercase">Subtopics</span>
              {t.subtopics.map((s) => (
                <Chip key={s} tone="accent" on={s === subtopic} onClick={() => setSubtopic(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          ) : null}
        </section>

        <section aria-label={`Questions in ${path}`} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex flex-col">
              <h2 className="text-base font-semibold">{path}</h2>
              <span className="text-xs text-muted-foreground">Questions by step · instructors pick from these when logging</span>
            </div>
            <span className="text-xs text-muted-foreground">{live.length} questions</span>
          </div>
          {steps.map((step) => {
            const concept = step.code.startsWith("1.");
            const qs = live.filter((q) => (step.code ? q.step === step.code : true));
            const open = adding === step.code;
            return (
              <div key={step.code || "all"} className="flex flex-col gap-2.5 border-b border-muted px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    {step.code ? (
                      <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular", concept ? "bg-muted" : "bg-accent text-accent-foreground")}>{step.code}</span>
                    ) : null}
                    <span className="font-semibold">{step.label}</span>
                  </span>
                  {!concept ? (
                    <Button variant="ghost" className="h-9 text-primary" onClick={() => setAdding(open ? null : step.code)}>
                      {open ? "Cancel" : "+ Add question"}
                    </Button>
                  ) : null}
                </div>
                {concept ? <span className="text-[13px] text-muted-foreground">Concept step · checked by explanation, no question attached</span> : null}
                {qs.map((q) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-muted bg-surface-subtle px-3 py-2.5">
                    <span className="flex min-w-0 flex-[1_1_240px] flex-col">
                      <span className="font-semibold">{q.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {q.source || "—"}
                        {q.notes ? ` · ${q.notes}` : ""}
                      </span>
                    </span>
                    {q.origin === "promoted" ? <StatusPill tone="accent">From review</StatusPill> : null}
                    <Button variant="outline" className="h-9" disabled={pending} onClick={() => run(() => archiveQuestionAction(q.id, true))}>
                      Archive
                    </Button>
                  </div>
                ))}
                {!concept && !qs.length && !open ? <span className="text-[13px] font-medium text-warning">No question yet for this step</span> : null}
                {open ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      add(step.code);
                    }}
                    className="flex flex-col gap-3 rounded-lg border-2 border-primary p-3"
                  >
                    <div className="flex flex-wrap gap-3">
                      <label className="flex flex-[2_1_260px] flex-col gap-1.5 text-[13px] font-medium">
                        Question
                        <input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Range Sum Query – Immutable" className={input} />
                      </label>
                      <label className="flex flex-[1_1_160px] flex-col gap-1.5 text-[13px] font-medium">
                        Source
                        <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="e.g. LeetCode 303" className={input} />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Link (optional)
                      <input type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://leetcode.com/problems/…" className={input} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Notes for instructors (optional)
                      <textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={cn(input, "h-auto py-2")} />
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" className="h-10" disabled={pending || !draft.title.trim()}>
                        Add to {step.code || "this topic"}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })}
          {archived.length ? (
            <details className="border-t border-border px-4 py-3 text-[13px]">
              <summary className="cursor-pointer font-semibold text-muted-foreground">Archived ({archived.length})</summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {archived.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {q.step} · {q.title}
                    </span>
                    <Button variant="ghost" className="h-8 text-primary" disabled={pending} onClick={() => run(() => archiveQuestionAction(q.id, false))}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}

const STATUS = {
  added: ["Added to roadmap", "accent"],
  kept: ["Kept as extra", "neutral"],
  dismissed: ["Dismissed", "neutral"],
} as const;

function ReviewQueue({ roadmap, queue }: { roadmap: RoadmapLevel[]; queue: QueueItem[] }) {
  const [filter, setFilter] = useState<"new" | "added" | "kept" | "all">("new");
  const shown = queue.filter((q) => (filter === "all" ? true : filter === "new" ? !q.decision : q.decision?.status === filter));
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
        <b className="text-foreground">How this works</b>
        <span>1 · An instructor logs a question that isn&apos;t in the roadmap</span>
        <span>2 · The same question from different instructors is grouped</span>
        <span>3 · You add it to the roadmap, keep it as an extra, or dismiss it</span>
      </p>
      <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
        {(
          [
            ["new", "To review", queue.filter((q) => !q.decision).length],
            ["added", "Added", queue.filter((q) => q.decision?.status === "added").length],
            ["kept", "Kept as extra", queue.filter((q) => q.decision?.status === "kept").length],
            ["all", "All", queue.length],
          ] as const
        ).map(([key, label, count]) => (
          <Chip key={key} on={filter === key} onClick={() => setFilter(key)}>
            {label} · {count}
          </Chip>
        ))}
      </div>
      {shown.length ? shown.map((item) => <QueueCard key={item.key} item={item} roadmap={roadmap} />) : <EmptyState title="Nothing here" description="New off-roadmap questions appear when instructors log them." />}
    </div>
  );
}

function QueueCard({ item, roadmap }: { item: QueueItem; roadmap: RoadmapLevel[] }) {
  const { pending, run } = useAction();
  const [level, setLevel] = useState(item.suggested.level);
  const topics = roadmap[level]?.topics ?? [];
  const [topic, setTopic] = useState(item.suggested.topic);
  const t = topics.find((x) => x.topic === topic) ?? topics[0];
  const [subtopic, setSubtopic] = useState<string | null>(item.suggested.subtopic);
  const stepOptions = t?.steps.filter((s) => !s.code.startsWith("1.")) ?? [];
  const [step, setStep] = useState("3.1");
  const validStep = stepOptions.some((s) => s.code === step) ? step : (stepOptions[0]?.code ?? "");
  const validSub = t?.subtopics.length ? (t.subtopics.includes(subtopic ?? "") ? subtopic : t.subtopics[0]) : null;
  const status = item.decision ? STATUS[item.decision.status] : null;

  return (
    <article className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-semibold">{item.title}</h3>
            {status ? <StatusPill tone={status[1]}>{status[0]}</StatusPill> : <StatusPill tone="warning">New</StatusPill>}
          </div>
          <span className="text-[13px] text-muted-foreground">
            First asked {new Date(item.firstAsked).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} by {item.firstBy} · asked by {item.instructors.join(", ")}
          </span>
        </div>
        <dl className="flex gap-5 text-[13px]">
          <div>
            <dd className="font-heading text-2xl font-semibold tabular">{item.times}×</dd>
            <dt className="text-muted-foreground">asked</dt>
          </div>
          <div>
            <dd className="font-heading text-2xl font-semibold tabular">{item.instructors.length}</dd>
            <dt className="text-muted-foreground">instructors</dt>
          </div>
        </dl>
      </div>
      {item.decision ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-muted pt-3 text-[13px] text-sidebar-foreground">
          <span>
            {status?.[0]} by {item.decision.by}.
            {item.decision.status === "added" ? " Instructors can pick it now." : item.decision.status === "kept" ? " Stays searchable; not part of level completion." : ""}
          </span>
          <Button variant="ghost" className="h-9 text-primary" disabled={pending} onClick={() => run(() => undoDecisionAction(item.key))}>
            Undo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2.5 border-t border-muted pt-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Level
            <select
              value={level}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLevel(n);
                setTopic(roadmap[n].topics[0]?.topic ?? "");
                setSubtopic(roadmap[n].topics[0]?.subtopics[0] ?? null);
              }}
              className={cn(input, "w-28")}
            >
              {roadmap.map((l) => (
                <option key={l.level} value={l.level}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Topic
            <select
              value={t?.topic ?? ""}
              onChange={(e) => {
                setTopic(e.target.value);
                setSubtopic(topics.find((x) => x.topic === e.target.value)?.subtopics[0] ?? null);
              }}
              className={cn(input, "w-44")}
            >
              {topics.map((x) => (
                <option key={x.topic}>{x.topic}</option>
              ))}
            </select>
          </label>
          {t?.subtopics.length ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Subtopic
              <select value={validSub ?? ""} onChange={(e) => setSubtopic(e.target.value)} className={cn(input, "w-48")}>
                {t.subtopics.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          ) : null}
          {stepOptions.length ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Step
              <select value={validStep} onChange={(e) => setStep(e.target.value)} className={cn(input, "w-52")}>
                {stepOptions.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} · {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              className="h-10"
              disabled={pending}
              onClick={() => run(() => decideAction(item.key, "added", { level, topic: t.topic, subtopic: validSub, step: validStep }))}
            >
              Add to roadmap
            </Button>
            <Button variant="outline" className="h-10" disabled={pending} onClick={() => run(() => decideAction(item.key, "kept", null))}>
              Keep as extra
            </Button>
            <Button variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => decideAction(item.key, "dismissed", null))}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
