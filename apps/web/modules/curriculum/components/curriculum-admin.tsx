/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { ArrowLeft, ArrowRight, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "@/common/components/chips";
import { useConfirm } from "@/common/components/confirm";
import { EmptyState } from "@/common/components/empty-state";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { addQuestionAction, archiveQuestionAction, decideAction, structureAction, undoDecisionAction, updateQuestionAction, type StructureEdit } from "../actions";
import type { Question, QueueItem } from "../data";
import { levelName, liveTopics, MAX_LEVEL, subtopicNames, topicSteps, type Structure, type TopicDef } from "../lib/structure";
import { QuestionTitle } from "./question-title";

const input =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const label = "flex flex-col gap-1.5 text-[13px] font-medium";
const cleanName = (v: string) => v.replace(/\s+/g, " ").trim();
const edit = (e: StructureEdit) => () => structureAction(e);

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

function AddChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-input px-3.5 text-[13px] font-semibold text-primary hover:bg-muted">
      <Plus aria-hidden="true" className="size-3.5" />
      {children}
    </button>
  );
}

function IconButton({ label: text, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="size-9" aria-label={text} title={text} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

/** One text field with Save / Cancel, for names and titles. */
function NameForm({
  initial = "",
  placeholder,
  fieldLabel,
  submitLabel,
  required = true,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  fieldLabel: string;
  submitLabel: string;
  required?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const clean = cleanName(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!required || clean) onSubmit(clean);
      }}
      className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-primary p-3"
    >
      <label className={cn(label, "flex-[1_1_240px]")}>
        {fieldLabel}
        <input autoFocus required={required} maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={input} />
      </label>
      <Button type="button" variant="ghost" className="h-10" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" className="h-10" disabled={(required && !clean) || clean === cleanName(initial)}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function CurriculumAdmin({ structure, questions, queue }: { structure: Structure; questions: Question[]; queue: QueueItem[] }) {
  const [tab, setTab] = useState<"roadmap" | "steps" | "review">("roadmap");
  const toReview = queue.filter((q) => !q.decision).length;
  const tabs: [typeof tab, string, number | null][] = [
    ["roadmap", "Roadmap", null],
    ["steps", "Steps", null],
    ["review", "Off-roadmap questions", toReview],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Curriculum sections" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(([key, text, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3.5 text-sm font-semibold", tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {text}
            {count ? <StatusPill tone="warning">{count} to review</StatusPill> : null}
          </button>
        ))}
      </div>
      {tab === "roadmap" ? <RoadmapEditor structure={structure} questions={questions} /> : tab === "steps" ? <StepsEditor structure={structure} questions={questions} /> : <ReviewQueue structure={structure} queue={queue} />}
    </div>
  );
}

// ---------------------------------------------------------------- roadmap

type Open =
  | { kind: "addLevel" }
  | { kind: "levelTitle" }
  | { kind: "addTopic" }
  | { kind: "renameTopic" }
  | { kind: "topicSettings" }
  | { kind: "addSubtopic" }
  | { kind: "renameSubtopic" }
  | null;

function RoadmapEditor({ structure, questions }: { structure: Structure; questions: Question[] }) {
  const { ask, dialog, pending } = useConfirm();
  const [level, setLevel] = useState(structure.levels.some((l) => l.level === 1) ? 1 : (structure.levels[0]?.level ?? 0));
  const [topicId, setTopicId] = useState<string | null>(null);
  const [subtopicId, setSubtopicId] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);

  const lvl = structure.levels.find((l) => l.level === level) ?? structure.levels[0];
  const topics = liveTopics(structure, lvl.level);
  const archivedTopics = lvl.topics.filter((t) => t.archived);
  const t = topics.find((x) => x.id === topicId) ?? topics[0];
  const subs = t?.subtopics.filter((s) => !s.archived) ?? [];
  const archivedSubs = t?.subtopics.filter((s) => s.archived) ?? [];
  const sub = subs.find((s) => s.id === subtopicId) ?? subs[0] ?? null;
  const nextLevel = Math.max(...structure.levels.map((l) => l.level)) + 1;
  const path = `${levelName(lvl.level)}${t ? ` › ${t.name}` : ""}${sub ? ` › ${sub.name}` : ""}`;

  function pickLevel(n: number) {
    setLevel(n);
    setTopicId(null);
    setSubtopicId(null);
    setOpen(null);
  }
  function pickTopic(id: string) {
    setTopicId(id);
    setSubtopicId(null);
    setOpen(null);
  }
  const close = () => setOpen(null);
  const stepText = (code: string | null) => (code ? `Up to ${code} ${structure.steps.find((s) => s.code === code)?.label ?? ""}`.trim() : "Every step");

  return (
    <div className="flex flex-wrap items-start gap-5">
      {dialog}
      <nav aria-label="Levels" className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 rounded-xl border border-border bg-card p-3">
        {structure.levels.map((l) => {
          const count = questions.filter((q) => q.level === l.level && !q.archived).length;
          const on = l.level === lvl.level;
          const live = l.topics.filter((x) => !x.archived).length;
          return (
            <button
              key={l.level}
              type="button"
              aria-pressed={on}
              onClick={() => pickLevel(l.level)}
              className={cn("flex min-h-12 items-center gap-3 rounded-lg border px-3 text-left", on ? "border-accent-border bg-accent" : "border-transparent hover:bg-muted")}
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg font-heading text-[13px] font-bold", on ? "bg-primary text-primary-foreground" : "bg-muted")}>L{l.level}</span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{l.title ? `${levelName(l.level)} · ${l.title}` : levelName(l.level)}</span>
                <span className="text-xs text-muted-foreground">{live ? `${live} topics · ${count} questions` : "No topics yet"}</span>
              </span>
            </button>
          );
        })}
        {open?.kind === "addLevel" ? (
          <div className="mt-1">
            <NameForm
              fieldLabel={`Title for Level ${nextLevel} (optional)`}
              placeholder="e.g. Advanced DP"
              submitLabel="Add level"
              required={false}
              onCancel={close}
              onSubmit={(title) =>
                ask({
                  title: `Add Level ${nextLevel}?`,
                  description: "Add its topics next. Instructors can pick the level once it has a topic.",
                  changes: [
                    { label: "New level", after: levelName(nextLevel) },
                    ...(title ? [{ label: "Title", after: title }] : []),
                  ],
                  confirmLabel: "Add level",
                  action: edit({ kind: "addLevel", title }),
                  onSuccess: () => {
                    close();
                    pickLevel(nextLevel);
                  },
                })
              }
            />
          </div>
        ) : nextLevel <= MAX_LEVEL ? (
          <Button variant="ghost" className="mt-1 h-10 justify-start text-primary" onClick={() => setOpen({ kind: "addLevel" })}>
            <Plus aria-hidden="true" className="size-4" /> Add level
          </Button>
        ) : null}
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <section aria-label={`${levelName(lvl.level)} topics`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <h2 className="text-lg font-semibold">
                {levelName(lvl.level)}
                {lvl.title ? <span className="font-normal text-muted-foreground"> · {lvl.title}</span> : null}
              </h2>
              <span className="text-xs text-muted-foreground">Topics in teaching order · instructors pick from these when logging</span>
            </div>
            {open?.kind !== "levelTitle" ? (
              <Button variant="ghost" className="h-9 text-primary" onClick={() => setOpen({ kind: "levelTitle" })}>
                <Pencil aria-hidden="true" className="size-3.5" /> {lvl.title ? "Edit title" : "Add title"}
              </Button>
            ) : null}
          </div>
          {open?.kind === "levelTitle" ? (
            <NameForm
              initial={lvl.title}
              fieldLabel={`Title for ${levelName(lvl.level)}`}
              placeholder="e.g. Recursion & sorting"
              submitLabel="Save title"
              required={false}
              onCancel={close}
              onSubmit={(title) =>
                ask({
                  title: `Change the title of ${levelName(lvl.level)}?`,
                  changes: [{ label: "Title", before: lvl.title || null, after: title || null }],
                  confirmLabel: "Save title",
                  action: edit({ kind: "levelTitle", level: lvl.level, title }),
                  onSuccess: close,
                })
              }
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {topics.map((x) => (
              <Chip key={x.id} on={x.id === t?.id} onClick={() => pickTopic(x.id)}>
                {x.name}
              </Chip>
            ))}
            {open?.kind !== "addTopic" ? <AddChip onClick={() => setOpen({ kind: "addTopic" })}>Add topic</AddChip> : null}
          </div>
          {open?.kind === "addTopic" ? (
            <TopicForm
              structure={structure}
              level={lvl.level}
              onCancel={close}
              onSubmit={(v) =>
                ask({
                  title: `Add a topic to ${levelName(lvl.level)}?`,
                  description: "Instructors can pick it in new interactions right away.",
                  changes: [
                    { label: "Topic", after: v.name },
                    { label: "Place", after: `${levelName(lvl.level)}, after ${topics.at(-1)?.name ?? "nothing"}` },
                    ...(lvl.level > 0 ? [{ label: "Steps", after: stepText(v.maxStep) }] : []),
                    { label: "Level completion", after: v.required ? "Counts" : "Optional" },
                  ],
                  confirmLabel: "Add topic",
                  action: edit({ kind: "addTopic", level: lvl.level, ...v }),
                  onSuccess: close,
                })
              }
            />
          ) : null}

          {t ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {lvl.level > 0 ? `${stepText(t.maxStep)} · ` : ""}
                  {t.required ? "Counts towards completing the level" : "Optional for completing the level"}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-0.5">
                <IconButton label={`Move ${t.name} earlier`} disabled={pending || topics[0]?.id === t.id} onClick={() => ask({ title: `Move "${t.name}" earlier?`, changes: [{ label: "Order", before: topicOrder(topics), after: topicOrder(swap(topics, t, -1)) }], confirmLabel: "Move", action: edit({ kind: "moveTopic", id: t.id, direction: -1 }) })}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                </IconButton>
                <IconButton label={`Move ${t.name} later`} disabled={pending || topics.at(-1)?.id === t.id} onClick={() => ask({ title: `Move "${t.name}" later?`, changes: [{ label: "Order", before: topicOrder(topics), after: topicOrder(swap(topics, t, 1)) }], confirmLabel: "Move", action: edit({ kind: "moveTopic", id: t.id, direction: 1 }) })}>
                  <ArrowRight aria-hidden="true" className="size-4" />
                </IconButton>
                <Button variant="ghost" className="h-9" onClick={() => setOpen({ kind: "renameTopic" })}>
                  Rename
                </Button>
                <Button variant="ghost" className="h-9" onClick={() => setOpen({ kind: "topicSettings" })}>
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 text-muted-foreground"
                  disabled={pending || topics.length <= 1}
                  onClick={() =>
                    ask({
                      title: `Archive "${t.name}"?`,
                      description: "It leaves the pickers for new interactions. Past interactions and students already on it keep it. You can restore it later.",
                      changes: [{ label: "Topic", before: t.name, after: "Archived" }],
                      confirmLabel: "Archive topic",
                      danger: true,
                      action: edit({ kind: "archiveTopic", id: t.id, archived: true }),
                      onSuccess: () => setTopicId(null),
                    })
                  }
                >
                  Archive
                </Button>
              </span>
            </div>
          ) : null}
          {t && open?.kind === "renameTopic" ? (
            <NameForm
              initial={t.name}
              fieldLabel="Topic name"
              submitLabel="Rename"
              onCancel={close}
              onSubmit={(name) =>
                ask({
                  title: `Rename "${t.name}"?`,
                  description: "Only possible while nothing has been logged with this name; its questions move with it.",
                  changes: [{ label: "Topic", before: t.name, after: name }],
                  confirmLabel: "Rename",
                  action: edit({ kind: "updateTopic", id: t.id, name }),
                  onSuccess: close,
                })
              }
            />
          ) : null}
          {t && open?.kind === "topicSettings" ? (
            <TopicForm
              structure={structure}
              level={lvl.level}
              topic={t}
              onCancel={close}
              onSubmit={(v) =>
                ask({
                  title: `Change the settings of "${t.name}"?`,
                  changes: [
                    ...(lvl.level > 0 ? [{ label: "Steps", before: stepText(t.maxStep), after: stepText(v.maxStep) }] : []),
                    { label: "Level completion", before: t.required ? "Counts" : "Optional", after: v.required ? "Counts" : "Optional" },
                  ],
                  confirmLabel: "Save settings",
                  action: edit({ kind: "updateTopic", id: t.id, maxStep: v.maxStep, required: v.required }),
                  onSuccess: close,
                })
              }
            />
          ) : null}

          {t ? (
            <div className="flex flex-col gap-2.5 border-t border-muted pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-bold text-muted-foreground uppercase">Subtopics</span>
                {subs.map((s) => (
                  <Chip key={s.id} tone="accent" on={s.id === sub?.id} onClick={() => setSubtopicId(s.id)}>
                    {s.name}
                  </Chip>
                ))}
                {open?.kind !== "addSubtopic" ? <AddChip onClick={() => setOpen({ kind: "addSubtopic" })}>Add subtopic</AddChip> : null}
              </div>
              {!subs.length ? <span className="text-[13px] text-muted-foreground">No subtopics. Questions sit on the topic itself.</span> : null}
              {open?.kind === "addSubtopic" ? (
                <NameForm
                  fieldLabel={`New subtopic of ${t.name}`}
                  placeholder="e.g. Sliding window maximum"
                  submitLabel="Add subtopic"
                  onCancel={close}
                  onSubmit={(name) =>
                    ask({
                      title: `Add a subtopic to "${t.name}"?`,
                      description: subs.length
                        ? "Instructors can pick it in new interactions right away."
                        : `${t.name} has no subtopics yet. Once it has one, instructors pick subtopics for it, and its questions are listed per subtopic.`,
                      changes: [
                        { label: "Subtopic", after: name },
                        { label: "Place", after: `${levelName(lvl.level)} › ${t.name}${subs.length ? `, after ${subs.at(-1)!.name}` : ""}` },
                      ],
                      confirmLabel: "Add subtopic",
                      action: edit({ kind: "addSubtopic", topicId: t.id, name }),
                      onSuccess: close,
                    })
                  }
                />
              ) : null}
              {sub ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2">
                  <span className="font-semibold">{sub.name}</span>
                  <span className="flex flex-wrap items-center gap-0.5">
                    <IconButton label={`Move ${sub.name} earlier`} disabled={pending || subs[0]?.id === sub.id} onClick={() => ask({ title: `Move "${sub.name}" earlier?`, changes: [{ label: "Order", before: topicOrder(subs), after: topicOrder(swap(subs, sub, -1)) }], confirmLabel: "Move", action: edit({ kind: "moveSubtopic", id: sub.id, direction: -1 }) })}>
                      <ArrowLeft aria-hidden="true" className="size-4" />
                    </IconButton>
                    <IconButton label={`Move ${sub.name} later`} disabled={pending || subs.at(-1)?.id === sub.id} onClick={() => ask({ title: `Move "${sub.name}" later?`, changes: [{ label: "Order", before: topicOrder(subs), after: topicOrder(swap(subs, sub, 1)) }], confirmLabel: "Move", action: edit({ kind: "moveSubtopic", id: sub.id, direction: 1 }) })}>
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </IconButton>
                    <Button variant="ghost" className="h-9" onClick={() => setOpen({ kind: "renameSubtopic" })}>
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-9 text-muted-foreground"
                      disabled={pending}
                      onClick={() =>
                        ask({
                          title: `Archive "${sub.name}"?`,
                          description: "It leaves the pickers for new interactions. Past interactions keep it. You can restore it later.",
                          changes: [{ label: "Subtopic", before: sub.name, after: "Archived" }],
                          confirmLabel: "Archive subtopic",
                          danger: true,
                          action: edit({ kind: "archiveSubtopic", id: sub.id, archived: true }),
                          onSuccess: () => setSubtopicId(null),
                        })
                      }
                    >
                      Archive
                    </Button>
                  </span>
                </div>
              ) : null}
              {sub && open?.kind === "renameSubtopic" ? (
                <NameForm
                  initial={sub.name}
                  fieldLabel="Subtopic name"
                  submitLabel="Rename"
                  onCancel={close}
                  onSubmit={(name) =>
                    ask({
                      title: `Rename "${sub.name}"?`,
                      description: "Only possible while nothing has been logged with this name; its questions move with it.",
                      changes: [{ label: "Subtopic", before: sub.name, after: name }],
                      confirmLabel: "Rename",
                      action: edit({ kind: "renameSubtopic", id: sub.id, name }),
                      onSuccess: close,
                    })
                  }
                />
              ) : null}
            </div>
          ) : null}

          {archivedTopics.length || archivedSubs.length ? (
            <details className="border-t border-muted pt-3 text-[13px]">
              <summary className="cursor-pointer font-semibold text-muted-foreground">Archived ({archivedTopics.length + archivedSubs.length})</summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {archivedTopics.map((x) => (
                  <ArchivedRow key={x.id} text={`Topic · ${x.name}`} disabled={pending} onRestore={() => ask({ title: `Restore "${x.name}"?`, changes: [{ label: "Topic", before: "Archived", after: x.name }], confirmLabel: "Restore", action: edit({ kind: "archiveTopic", id: x.id, archived: false }) })} />
                ))}
                {archivedSubs.map((x) => (
                  <ArchivedRow key={x.id} text={`Subtopic of ${t?.name} · ${x.name}`} disabled={pending} onRestore={() => ask({ title: `Restore "${x.name}"?`, changes: [{ label: "Subtopic", before: "Archived", after: x.name }], confirmLabel: "Restore", action: edit({ kind: "archiveSubtopic", id: x.id, archived: false }) })} />
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        {t ? <QuestionList key={`${lvl.level}|${t.id}|${sub?.id ?? ""}`} structure={structure} level={lvl.level} topic={t} subtopic={sub?.name ?? null} path={path} questions={questions} /> : (
          <EmptyState title="No topics yet" description={`Add the first topic of ${levelName(lvl.level)} above.`} />
        )}
      </div>
    </div>
  );
}

const topicOrder = (list: { name: string }[]) => list.map((x) => x.name).join(" · ");
function swap<T extends { id: string }>(list: T[], item: T, direction: -1 | 1): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ArchivedRow({ text, onRestore, disabled }: { text: string; onRestore: () => void; disabled: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{text}</span>
      <Button variant="ghost" className="h-8 text-primary" disabled={disabled} onClick={onRestore}>
        Restore
      </Button>
    </li>
  );
}

function TopicForm({
  structure,
  level,
  topic,
  onSubmit,
  onCancel,
}: {
  structure: Structure;
  level: number;
  topic?: TopicDef;
  onSubmit: (v: { name: string; maxStep: string | null; required: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(topic?.name ?? "");
  const [maxStep, setMaxStep] = useState<string>(topic?.maxStep ?? "");
  const [required, setRequired] = useState(topic?.required ?? true);
  const clean = cleanName(name);
  const changed = !topic || (maxStep || null) !== topic.maxStep || required !== topic.required;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onSubmit({ name: clean, maxStep: level === 0 ? null : maxStep || null, required });
      }}
      className="flex flex-col gap-3 rounded-lg border-2 border-primary p-3"
    >
      <div className="flex flex-wrap gap-3">
        {!topic ? (
          <label className={cn(label, "flex-[2_1_240px]")}>
            Topic name
            <input autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tries" className={input} />
          </label>
        ) : null}
        {level > 0 ? (
          <label className={cn(label, "flex-[1_1_220px]")}>
            Steps for this topic
            <select value={maxStep} onChange={(e) => setMaxStep(e.target.value)} className={input}>
              <option value="">Every step</option>
              {structure.steps
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    Up to {s.code} · {s.label}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>
      <label className="flex items-center gap-2.5 text-[13px] font-medium">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-[18px] accent-primary" />
        Counts towards completing the level
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-10" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-10" disabled={!clean || !changed}>
          {topic ? "Save settings" : "Add topic"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- questions

type Draft = { title: string; url: string; source: string; notes: string };
const BLANK: Draft = { title: "", url: "", source: "", notes: "" };
const linkOk = (url: string) => !url.trim() || /^https:\/\/\S+$/i.test(url.trim());

function QuestionFields({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const badLink = !linkOk(draft.url);
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className={cn(label, "flex-[2_1_260px]")}>
          <span>
            Question name <span className="text-[#C42B1C]" aria-hidden="true">*</span>
          </span>
          <input autoFocus required aria-required="true" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Range Sum Query – Immutable" className={input} />
        </label>
        <label className={cn(label, "flex-[1_1_160px]")}>
          Source (optional)
          <input maxLength={120} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="e.g. LeetCode 303" className={input} />
        </label>
      </div>
      <label className={label}>
        Link (optional)
        <input
          type="url"
          inputMode="url"
          maxLength={500}
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          placeholder="https://leetcode.com/problems/…"
          aria-invalid={badLink}
          aria-describedby="link-hint"
          className={cn(input, badLink && "border-[#C42B1C]")}
        />
        <span id="link-hint" className={cn("text-xs font-normal", badLink ? "text-[#C42B1C]" : "text-muted-foreground")}>
          {badLink ? "Links must start with https://" : "With a link, the question name opens it. Without one, it shows as plain text."}
        </span>
      </label>
      <label className={label}>
        Notes for instructors (optional)
        <textarea rows={2} maxLength={1000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={cn(input, "h-auto py-2")} />
      </label>
    </>
  );
}

function QuestionList({
  structure,
  level,
  topic,
  subtopic,
  path,
  questions,
}: {
  structure: Structure;
  level: number;
  topic: TopicDef;
  subtopic: string | null;
  path: string;
  questions: Question[];
}) {
  const { ask, dialog, pending } = useConfirm();
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);

  const here = questions.filter((q) => q.level === level && q.topic === topic.name && q.subtopic === subtopic);
  const live = here.filter((q) => !q.archived);
  const archived = here.filter((q) => q.archived);
  const steps = level === 0 ? [{ code: "", label: "Questions" }] : topicSteps(structure, level, topic.name);
  const known = new Set(steps.map((s) => s.code));
  const other = level === 0 ? [] : live.filter((q) => !known.has(q.step));
  const groups = other.length ? [...steps, { code: "other", label: "Other steps (archived or past this topic's last step)" }] : steps;
  const linkPreview = (d: Draft) => (d.url.trim() ? `${d.title.trim()} → ${d.url.trim()}` : `${d.title.trim()} (no link, plain text)`);

  function startAdd(code: string) {
    setEditing(null);
    setDraft(BLANK);
    setAdding(adding === code ? null : code);
  }
  function startEdit(q: Question) {
    setAdding(null);
    setDraft({ title: q.title, url: q.url, source: q.source, notes: q.notes });
    setEditing(q.id);
  }
  const ready = !!draft.title.trim() && linkOk(draft.url);

  return (
    <section aria-label={`Questions in ${path}`} className="overflow-hidden rounded-xl border border-border bg-card">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">{path}</h2>
          <span className="text-xs text-muted-foreground">Questions by step · instructors pick from these when logging</span>
        </div>
        <span className="text-xs text-muted-foreground">{live.length} questions</span>
      </div>
      {groups.map((step) => {
        const qs = step.code === "other" ? other : live.filter((q) => (level === 0 ? true : q.step === step.code));
        const open = adding === step.code;
        return (
          <div key={step.code || "all"} className="flex flex-col gap-2.5 border-b border-muted px-4 py-3 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                {step.code && step.code !== "other" ? (
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular", step.code.startsWith("1.") ? "bg-muted" : "bg-accent text-accent-foreground")}>{step.code}</span>
                ) : null}
                <span className="font-semibold">{step.label}</span>
              </span>
              {step.code !== "other" ? (
                <Button variant="ghost" className="h-9 text-primary" onClick={() => startAdd(step.code)}>
                  {open ? "Cancel" : "+ Add question"}
                </Button>
              ) : null}
            </div>
            {qs.map((q) =>
              editing === q.id ? (
                <form
                  key={q.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!ready) return;
                    const d = { title: draft.title.trim(), url: draft.url.trim(), source: draft.source.trim(), notes: draft.notes.trim() };
                    const changes = [
                      ...(d.title !== q.title ? [{ label: "Name", before: q.title, after: d.title }] : []),
                      ...(d.url !== q.url ? [{ label: "Link", before: q.url || null, after: d.url || null }] : []),
                      ...(d.source !== q.source ? [{ label: "Source", before: q.source || null, after: d.source || null }] : []),
                      ...(d.notes !== q.notes ? [{ label: "Notes", before: q.notes || null, after: d.notes || null }] : []),
                    ];
                    if (!changes.length) return setEditing(null);
                    ask({ title: `Save changes to "${q.title}"?`, changes, confirmLabel: "Save question", action: () => updateQuestionAction(q.id, d), onSuccess: () => setEditing(null) });
                  }}
                  className="flex flex-col gap-3 rounded-lg border-2 border-primary p-3"
                >
                  <QuestionFields draft={draft} setDraft={setDraft} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="h-10" disabled={!ready}>
                      Save question
                    </Button>
                  </div>
                </form>
              ) : (
                <div key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-muted bg-surface-subtle px-3 py-2.5">
                  <span className="flex min-w-0 flex-[1_1_240px] flex-col">
                    <QuestionTitle title={q.title} url={q.url} />
                    <span className="text-xs text-muted-foreground">
                      {step.code === "other" ? `${q.step || "No step"} · ` : ""}
                      {q.source || "—"}
                      {q.notes ? ` · ${q.notes}` : ""}
                    </span>
                  </span>
                  {q.origin === "promoted" ? <StatusPill tone="accent">From review</StatusPill> : null}
                  <span className="flex gap-1">
                    <Button variant="ghost" className="h-9" disabled={pending} onClick={() => startEdit(q)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9"
                      disabled={pending}
                      onClick={() =>
                        ask({
                          title: `Archive "${q.title}"?`,
                          description: "Instructors stop seeing it. Past interactions keep it. You can restore it later.",
                          changes: [{ label: "Question", before: q.title, after: "Archived" }],
                          confirmLabel: "Archive question",
                          danger: true,
                          action: () => archiveQuestionAction(q.id, true),
                        })
                      }
                    >
                      Archive
                    </Button>
                  </span>
                </div>
              ),
            )}
            {step.code !== "other" && !qs.length && !open ? (
              <span className={cn("text-[13px] font-medium", step.code.startsWith("1.") || level === 0 ? "text-muted-foreground" : "text-warning")}>No question yet for this step</span>
            ) : null}
            {open ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!ready) return;
                  const d = { title: draft.title.trim(), url: draft.url.trim(), source: draft.source.trim(), notes: draft.notes.trim() };
                  ask({
                    title: "Add this question?",
                    description: "Instructors can pick it in new interactions right away.",
                    changes: [
                      { label: "Where", after: `${path}${step.code ? ` · ${step.code}` : ""}` },
                      { label: "Question", after: linkPreview(d) },
                      ...(d.source ? [{ label: "Source", after: d.source }] : []),
                      ...(d.notes ? [{ label: "Notes", after: d.notes }] : []),
                    ],
                    confirmLabel: "Add question",
                    action: () => addQuestionAction({ level, topic: topic.name, subtopic, step: step.code, ...d, tweakOf: null }),
                    onSuccess: () => {
                      setAdding(null);
                      setDraft(BLANK);
                    },
                  });
                }}
                className="flex flex-col gap-3 rounded-lg border-2 border-primary p-3"
              >
                <QuestionFields draft={draft} setDraft={setDraft} />
                <div className="flex justify-end">
                  <Button type="submit" className="h-10" disabled={!ready}>
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
          <summary className="cursor-pointer font-semibold text-muted-foreground">Archived questions ({archived.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {archived.map((q) => (
              <ArchivedRow
                key={q.id}
                text={`${q.step ? `${q.step} · ` : ""}${q.title}`}
                disabled={pending}
                onRestore={() => ask({ title: `Restore "${q.title}"?`, changes: [{ label: "Question", before: "Archived", after: q.title }], confirmLabel: "Restore", action: () => archiveQuestionAction(q.id, false) })}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- steps

function StepsEditor({ structure, questions }: { structure: Structure; questions: Question[] }) {
  const { ask, dialog, pending } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const live = structure.steps.filter((s) => !s.archived);
  const archived = structure.steps.filter((s) => s.archived);
  const codeOk = /^[1-9]\d?\.[1-9]\d?$/.test(code.trim());
  const taken = structure.steps.some((s) => s.code === code.trim());
  const used = (c: string) => questions.filter((q) => q.step === c && !q.archived).length;

  return (
    <section aria-label="Steps" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      {dialog}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Steps</h2>
          <span className="text-[13px] text-muted-foreground">
            What a student reached in an interaction, the same for every topic from Level 1 up. A topic can stop at an earlier step (its Settings). Level 0 has no steps.
          </span>
        </div>
        {!adding ? (
          <Button variant="ghost" className="h-9 text-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" /> Add step
          </Button>
        ) : null}
      </div>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim();
            const l = cleanName(text);
            if (!codeOk || taken || !l) return;
            ask({
              title: `Add step ${c}?`,
              description: "It shows in the step pickers of every topic that doesn't stop before it.",
              changes: [{ label: "Step", after: `${c} ${l}` }],
              confirmLabel: "Add step",
              action: edit({ kind: "addStep", code: c, label: l }),
              onSuccess: () => {
                setAdding(false);
                setCode("");
                setText("");
              },
            });
          }}
          className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-primary p-3"
        >
          <label className={cn(label, "w-28")}>
            Number
            <input autoFocus required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 4.2" inputMode="decimal" maxLength={5} aria-invalid={!!code && (!codeOk || taken)} className={input} />
          </label>
          <label className={cn(label, "flex-[1_1_240px]")}>
            What it means
            <input required maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Hard tweaked question" className={input} />
          </label>
          <Button type="button" variant="ghost" className="h-10" onClick={() => setAdding(false)}>
            Cancel
          </Button>
          <Button type="submit" className="h-10" disabled={!codeOk || taken || !cleanName(text)}>
            Add step
          </Button>
          {code && (!codeOk || taken) ? <span className="w-full text-xs text-[#C42B1C]">{taken ? "That number is already a step." : "Write it as a number like 4.2."}</span> : null}
        </form>
      ) : null}
      <ul className="flex flex-col">
        {live.map((s, i) => (
          <li key={s.code} className={cn("flex flex-col gap-2 py-2.5", i > 0 && "border-t border-muted")}>
            {editing === s.code ? (
              <NameForm
                initial={s.label}
                fieldLabel={`What ${s.code} means`}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={(l) => ask({ title: `Change step ${s.code}?`, changes: [{ label: s.code, before: s.label, after: l }], confirmLabel: "Save step", action: edit({ kind: "updateStep", code: s.code, label: l }), onSuccess: () => setEditing(null) })}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular", s.code.startsWith("1.") ? "bg-muted" : "bg-accent text-accent-foreground")}>{s.code}</span>
                <span className="flex-1 font-semibold">{s.label}</span>
                <span className="text-xs text-muted-foreground">{used(s.code)} questions</span>
                <Button variant="ghost" className="h-9" onClick={() => setEditing(s.code)}>
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 text-muted-foreground"
                  disabled={pending || live.length <= 1}
                  onClick={() =>
                    ask({
                      title: `Archive step ${s.code}?`,
                      description: `It leaves the step pickers for new interactions. Past interactions keep it${used(s.code) ? `, and its ${used(s.code)} questions stay in the bank` : ""}. You can restore it later.`,
                      changes: [{ label: "Step", before: `${s.code} ${s.label}`, after: "Archived" }],
                      confirmLabel: "Archive step",
                      danger: true,
                      action: edit({ kind: "updateStep", code: s.code, archived: true }),
                    })
                  }
                >
                  Archive
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {archived.length ? (
        <details className="border-t border-muted pt-3 text-[13px]">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Archived steps ({archived.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {archived.map((s) => (
              <ArchivedRow key={s.code} text={`${s.code} · ${s.label}`} disabled={pending} onRestore={() => ask({ title: `Restore step ${s.code}?`, changes: [{ label: "Step", before: "Archived", after: `${s.code} ${s.label}` }], confirmLabel: "Restore", action: edit({ kind: "updateStep", code: s.code, archived: false }) })} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- off-roadmap review

const STATUS = {
  added: ["Added to roadmap", "accent"],
  kept: ["Kept as extra", "neutral"],
  dismissed: ["Dismissed", "neutral"],
} as const;

function ReviewQueue({ structure, queue }: { structure: Structure; queue: QueueItem[] }) {
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
        ).map(([key, text, count]) => (
          <Chip key={key} on={filter === key} onClick={() => setFilter(key)}>
            {text} · {count}
          </Chip>
        ))}
      </div>
      {shown.length ? shown.map((item) => <QueueCard key={item.key} item={item} structure={structure} />) : <EmptyState title="Nothing here" description="New off-roadmap questions appear when instructors log them." />}
    </div>
  );
}

function QueueCard({ item, structure }: { item: QueueItem; structure: Structure }) {
  const { ask, dialog, pending } = useConfirm();
  const levels = structure.levels.filter((l) => liveTopics(structure, l.level).length);
  const [level, setLevel] = useState(levels.some((l) => l.level === item.suggested.level) ? item.suggested.level : (levels[0]?.level ?? 0));
  const topics = liveTopics(structure, level);
  const [topic, setTopic] = useState(item.suggested.topic);
  const t = topics.find((x) => x.name === topic) ?? topics[0];
  const subs = t ? subtopicNames(structure, level, t.name) : [];
  const [subtopic, setSubtopic] = useState<string | null>(item.suggested.subtopic);
  const stepOptions = t ? topicSteps(structure, level, t.name) : [];
  const [step, setStep] = useState("3.1");
  const validStep = level === 0 ? "" : stepOptions.some((s) => s.code === step) ? step : (stepOptions[0]?.code ?? "");
  const validSub = subs.length ? (subs.includes(subtopic ?? "") ? subtopic : subs[0]) : null;
  const status = item.decision ? STATUS[item.decision.status] : null;
  const where = t ? `${levelName(level)} › ${t.name}${validSub ? ` › ${validSub}` : ""}${validStep ? ` · ${validStep}` : ""}` : "";

  return (
    <article className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
      {dialog}
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
          <Button
            variant="ghost"
            className="h-9 text-primary"
            disabled={pending}
            onClick={() =>
              ask({
                title: `Undo "${status?.[0]}"?`,
                description: item.decision?.status === "added" ? "The question is taken out of the roadmap again and goes back to review." : "It goes back to review.",
                changes: [{ label: "Decision", before: status?.[0] ?? null, after: "To review" }],
                confirmLabel: "Undo",
                action: () => undoDecisionAction(item.key),
              })
            }
          >
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
                const first = liveTopics(structure, n)[0];
                setTopic(first?.name ?? "");
                setSubtopic(first ? (subtopicNames(structure, n, first.name)[0] ?? null) : null);
              }}
              className={cn(input, "w-28")}
            >
              {levels.map((l) => (
                <option key={l.level} value={l.level}>
                  {levelName(l.level)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Topic
            <select
              value={t?.name ?? ""}
              onChange={(e) => {
                setTopic(e.target.value);
                setSubtopic(subtopicNames(structure, level, e.target.value)[0] ?? null);
              }}
              className={cn(input, "w-44")}
            >
              {topics.map((x) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </select>
          </label>
          {subs.length ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Subtopic
              <select value={validSub ?? ""} onChange={(e) => setSubtopic(e.target.value)} className={cn(input, "w-48")}>
                {subs.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          ) : null}
          {stepOptions.length && level > 0 ? (
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
              disabled={pending || !t}
              onClick={() =>
                ask({
                  title: "Add it to the roadmap?",
                  description: "Instructors can pick it in new interactions right away.",
                  changes: [
                    { label: "Question", after: item.title },
                    { label: "Where", after: where },
                  ],
                  confirmLabel: "Add to roadmap",
                  action: () => decideAction(item.key, "added", { level, topic: t.name, subtopic: validSub, step: validStep }),
                })
              }
            >
              Add to roadmap
            </Button>
            <Button
              variant="outline"
              className="h-10"
              disabled={pending}
              onClick={() => ask({ title: "Keep it as an extra?", description: "It stays searchable but isn't part of the roadmap.", changes: [{ label: "Question", after: item.title }], confirmLabel: "Keep as extra", action: () => decideAction(item.key, "kept", null) })}
            >
              Keep as extra
            </Button>
            <Button
              variant="ghost"
              className="h-10"
              disabled={pending}
              onClick={() => ask({ title: "Dismiss it?", description: "You can undo this later.", changes: [{ label: "Question", after: item.title }], confirmLabel: "Dismiss", action: () => decideAction(item.key, "dismissed", null) })}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

