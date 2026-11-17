/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { ClipboardPaste, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logInteraction } from "@/modules/interactions/actions";
import { Button } from "@/common/ui/button";
import { getReachedStepOptions, getSubtopicOptions, getTopicOptions, LEVELS } from "@/modules/interactions/lib/curriculum";
import { clearInteractionDraft, interactionDraftKey, loadInteractionDraft, saveInteractionDraft } from "@/modules/interactions/lib/draft";
import { blockKeyboardSubmit } from "@/modules/interactions/lib/forms";
import { questionsFor, type BankQuestion } from "@/modules/interactions/lib/question-bank";
import { parseSheetRow } from "@/modules/interactions/lib/sheet-row-parser";
import { interactionInput, STATUSES, STATUS_LABEL, type InteractionStatus } from "@/modules/interactions/lib/types";
import { cn } from "@/common/lib/utils";

export type FormStudent = {
  niatId: string;
  name: string;
  group: string;
  level: number;
  topic: string;
  subtopic: string | null;
  attendance30d: number;
  lastInteractionDays: number | null;
  lastInteractionLabel: string | null;
  contestAbsentStreak: number;
  latestTest: number | null;
};

type Fields = {
  date: string;
  takenBy: string;
  level: number;
  topics: string[];
  subtopics: string[];
  stepsReached: Record<string, string>;
  status: InteractionStatus;
  rating: number;
  picked: string[];
  offRoadmap: string[];
  tweakedQuestions: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  actionItems: string;
  meetRecording: string;
  transcriptUrl: string;
  transcriptText: string;
};

const levelName = (n: number) => `Level ${n}`;

function blankFields(student: FormStudent | undefined, today: string, takenBy: string): Fields {
  return {
    date: today,
    takenBy,
    level: student?.level ?? 0,
    topics: student ? [student.topic] : [],
    subtopics: student?.subtopic ? [student.subtopic] : [],
    stepsReached: {},
    status: "In Progress",
    rating: 3,
    picked: [],
    offRoadmap: [],
    tweakedQuestions: "",
    remarks: "",
    performedWell: "",
    improvementAreas: "",
    actionItems: "",
    meetRecording: "",
    transcriptUrl: "",
    transcriptText: "",
  };
}

const input =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-warning-strong";
const area =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-warning-strong";
const label = "flex flex-col gap-1.5 text-[13px] font-medium";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="text-xs font-semibold text-warning">
      {message}
    </span>
  ) : null;
}

function Chip({ on, onClick, children, tone = "dark" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "dark" | "accent" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 text-[13px] font-semibold",
        on
          ? tone === "dark"
            ? "border-foreground bg-foreground text-background"
            : "border-accent-border bg-accent text-accent-foreground"
          : "border-input bg-card text-sidebar-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function InteractionForm({
  students,
  instructors,
  userId,
  userName,
  initialStudent,
  today,
  questionBank,
}: {
  /** Live question bank from the Curriculum module, keyed by bankKey(). */
  questionBank: Record<string, BankQuestion[]>;
  students: FormStudent[];
  instructors: string[];
  userId: string;
  userName: string;
  initialStudent?: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [niatId, setNiatId] = useState(students.some((s) => s.niatId === initialStudent) ? initialStudent! : "");
  const student = students.find((s) => s.niatId === niatId);
  // "Taken by" is not filled in from the signed-in user (rule carried over from the Interactions app).
  const [f, setF] = useState<Fields>(() => blankFields(student, today, ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftOff, setDraftOff] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteWarnings, setPasteWarnings] = useState<string[]>([]);
  const loadedKey = useRef<string | null>(null);

  const draftKey = niatId ? interactionDraftKey(userId, { studentId: niatId }) : null;
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }));

  // Restore a saved draft when a student is picked.
  useEffect(() => {
    if (!draftKey || loadedKey.current === draftKey) return;
    loadedKey.current = draftKey;
    const draft = loadInteractionDraft<Fields>(draftKey);
    setF(draft ? { ...blankFields(student, today, ""), ...draft.fields } : blankFields(student, today, ""));
    setDraftNotice(draft ? new Date(draft.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null);
    setErrors({});
  }, [draftKey, student, today]);

  // Keep the draft up to date (after the first load for this student).
  useEffect(() => {
    if (!draftKey || loadedKey.current !== draftKey) return;
    const untouched = JSON.stringify(f) === JSON.stringify(blankFields(student, today, ""));
    const t = setTimeout(() => (untouched ? clearInteractionDraft(draftKey) : saveInteractionDraft(draftKey, f)), 400);
    return () => clearTimeout(t);
  }, [draftKey, f, student, today]);

  const level = levelName(f.level);
  const topicOptions = getTopicOptions(level);
  const subtopicMode = f.topics.length === 1 && getSubtopicOptions(level, f.topics[0]).length > 0;
  const subtopicOptions = subtopicMode ? getSubtopicOptions(level, f.topics[0]) : [];
  const stepOptions = getReachedStepOptions(level);
  const stepItems = stepOptions.length ? (subtopicMode ? f.subtopics : f.topics) : [];
  const bank = questionsFor(level, f.topics, subtopicMode ? f.subtopics : [], questionBank);
  const words = f.transcriptText.trim() ? f.transcriptText.trim().split(/\s+/).length : 0;

  function changeLevel(n: number) {
    setF((prev) => ({ ...prev, level: n, topics: [getTopicOptions(levelName(n))[0]], subtopics: [], stepsReached: {}, picked: [] }));
  }
  function toggleTopic(topic: string) {
    setF((prev) => {
      const topics = prev.topics.includes(topic) ? prev.topics.filter((t) => t !== topic) : [...prev.topics, topic];
      return { ...prev, topics, subtopics: [], stepsReached: {}, picked: [] };
    });
  }
  function toggleSubtopic(sub: string) {
    setF((prev) => ({ ...prev, subtopics: prev.subtopics.includes(sub) ? prev.subtopics.filter((s) => s !== sub) : [...prev.subtopics, sub] }));
  }
  function addOffRoadmap() {
    const title = draftOff.trim();
    if (!title || f.offRoadmap.includes(title)) return;
    set("offRoadmap", [...f.offRoadmap, title]);
    setDraftOff("");
  }

  function applyPaste() {
    const result = parseSheetRow(pasteText, topicOptions, today);
    const v = result.values;
    setF((prev) => ({
      ...prev,
      date: v.date ?? prev.date,
      takenBy: v.takenByName && instructors.includes(v.takenByName) ? v.takenByName : prev.takenBy,
      topics: v.topics?.length ? (v.topics.length === 1 ? v.topics : v.topics) : prev.topics,
      subtopics: v.topics?.length ? [] : prev.subtopics,
      status: v.status ?? prev.status,
      rating: v.rating ?? prev.rating,
      tweakedQuestions: [prev.tweakedQuestions, v.questionsAsked, v.tweakedQuestions].filter(Boolean).join("\n"),
      remarks: v.remarks ?? prev.remarks,
      performedWell: v.performedWell ?? prev.performedWell,
      improvementAreas: v.improvementAreas ?? prev.improvementAreas,
      actionItems: v.actionItems ?? prev.actionItems,
      meetRecording: v.meetRecording ?? prev.meetRecording,
    }));
    const warnings = [...result.warnings];
    if (v.takenByName && !instructors.includes(v.takenByName)) warnings.push(`"${v.takenByName}" isn't in the instructor list. Pick "Taken by" by hand.`);
    setPasteWarnings(warnings);
    if (result.filled) {
      toast.success(`Filled ${result.filled} field${result.filled === 1 ? "" : "s"} from the sheet. Check them before saving.`);
      if (!warnings.length) setPasteOpen(false);
    }
  }

  function submit() {
    if (!student) {
      setErrors({ niatId: "Pick a student" });
      return;
    }
    const payload = {
      niatId,
      date: f.date,
      takenBy: f.takenBy,
      level: f.level,
      topics: f.topics,
      subtopics: subtopicMode ? f.subtopics : [],
      stepsReached: Object.fromEntries(stepItems.filter((item) => f.stepsReached[item]).map((item) => [item, f.stepsReached[item]])),
      status: f.status,
      rating: f.rating,
      questions: [
        ...bank.filter((q) => f.picked.includes(q.title)).map((q) => ({ title: q.title, step: q.step, offRoadmap: false })),
        ...f.offRoadmap.map((title) => ({ title, offRoadmap: true })),
      ],
      tweakedQuestions: f.tweakedQuestions,
      remarks: f.remarks,
      performedWell: f.performedWell,
      improvementAreas: f.improvementAreas,
      actionItems: f.actionItems,
      meetRecording: f.meetRecording,
      transcriptUrl: f.transcriptUrl,
      transcriptText: f.transcriptText,
    };
    const next: Record<string, string> = {};
    const parsed = interactionInput.safeParse(payload);
    if (!parsed.success) for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    if (subtopicMode && f.subtopics.length === 0) next.subtopics = "Pick the subtopic(s) covered";
    if (stepItems.some((item) => !f.stepsReached[item])) next.stepsReached = "Pick the step reached for each item";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Some fields need attention.");
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    startTransition(async () => {
      const result = await logInteraction(payload);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      if (draftKey) clearInteractionDraft(draftKey);
      setDraftNotice(null);
      setF(blankFields(student, today, f.takenBy));
      toast.success(
        `Saved · round ${result.round} logged for ${result.studentName}` +
          (result.offRoadmap ? ` · ${result.offRoadmap} off-roadmap question${result.offRoadmap === 1 ? "" : "s"} sent for review` : ""),
      );
      router.refresh();
    });
  }

  return (
    <form
      aria-label="Log an interaction"
      onKeyDown={blockKeyboardSubmit}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 rounded-xl border border-border bg-card p-5"
      noValidate
    >
      <div className="flex flex-wrap gap-3">
        <label className={cn(label, "flex-[2_1_240px]")}>
          Student
          <select
            value={niatId}
            onChange={(event) => setNiatId(event.target.value)}
            aria-invalid={!!errors.niatId}
            aria-describedby="err-student"
            className={input}
          >
            <option value="">Pick one of your students…</option>
            {students.map((s) => (
              <option key={s.niatId} value={s.niatId}>
                {s.name} · {s.niatId}
              </option>
            ))}
          </select>
          <FieldError id="err-student" message={errors.niatId} />
        </label>
        <label className={cn(label, "flex-[1_1_150px]")}>
          Date
          <input type="date" value={f.date} max={today} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} aria-describedby="err-date" className={input} />
          <FieldError id="err-date" message={errors.date} />
        </label>
        <label className={cn(label, "flex-[1_1_170px]")}>
          Taken by
          <select value={f.takenBy} onChange={(e) => set("takenBy", e.target.value)} aria-invalid={!!errors.takenBy} aria-describedby="err-taken" className={input}>
            <option value="">Pick…</option>
            {instructors.map((name) => (
              <option key={name} value={name}>
                {name}
                {name === userName ? " (you)" : ""}
              </option>
            ))}
          </select>
          <FieldError id="err-taken" message={errors.takenBy} />
        </label>
      </div>

      {student ? (
        <>
          {draftNotice ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent px-3 py-2 text-[13px] text-accent-foreground">
              <span>Restored your unsaved draft from {draftNotice}.</span>
              <button
                type="button"
                onClick={() => {
                  if (draftKey) clearInteractionDraft(draftKey);
                  setF(blankFields(student, today, ""));
                  setDraftNotice(null);
                }}
                className="min-h-8 rounded-md px-2 font-semibold underline-offset-2 hover:underline"
              >
                Discard draft
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg bg-background px-3.5 py-3 text-[13px] text-sidebar-foreground">
            <span className="w-full font-semibold text-foreground">From other modules · {student.group}</span>
            <span>
              Attendance 30d: <b className={cn(student.attendance30d < 75 && "text-warning")}>{student.attendance30d}%</b>
            </span>
            <span>Last interaction: {student.lastInteractionLabel ?? "none yet"}</span>
            <span>Latest weekly test: {student.latestTest !== null ? `${student.latestTest} / 50` : "—"}</span>
            <span>Contests: {student.contestAbsentStreak >= 3 ? <b className="text-warning">absent last {student.contestAbsentStreak}</b> : "attending"}</span>
            <a href={`/students/${student.niatId}`} className="font-semibold text-primary hover:text-accent-strong">
              Open student page →
            </a>
          </div>

          <div className="flex flex-col gap-2.5 rounded-lg border border-dashed border-input p-3">
            <button
              type="button"
              aria-expanded={pasteOpen}
              onClick={() => setPasteOpen((o) => !o)}
              className="flex min-h-9 items-center gap-2 self-start text-[13px] font-semibold text-sidebar-foreground hover:text-foreground"
            >
              <ClipboardPaste aria-hidden="true" className="size-4" /> Paste a row from the interaction sheet
            </button>
            {pasteOpen ? (
              <>
                <textarea
                  rows={3}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  aria-label="Row copied from the sheet"
                  placeholder="Copy the header row and one row from Google Sheets (or a Markdown table) and paste here"
                  className={cn(area, "font-mono text-xs")}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={applyPaste} disabled={!pasteText.trim()}>
                    Fill the form
                  </Button>
                  <span className="text-xs text-muted-foreground">Nothing is saved until you press Save interaction.</span>
                </div>
                {pasteWarnings.length ? (
                  <ul className="list-disc rounded-lg bg-warning-soft py-2 pr-3 pl-7 text-xs text-warning">
                    {pasteWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[13px] font-semibold">What was covered</legend>
            <label className={cn(label, "max-w-48")}>
              Level
              <select value={f.level} onChange={(e) => changeLevel(Number(e.target.value))} className={input}>
                {LEVELS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Topics" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Topics</span>
              <div className="flex flex-wrap gap-2">
                {topicOptions.map((topic) => (
                  <Chip key={topic} on={f.topics.includes(topic)} onClick={() => toggleTopic(topic)}>
                    {topic}
                  </Chip>
                ))}
              </div>
              <FieldError id="err-topics" message={errors.topics} />
            </div>
            {subtopicMode ? (
              <div role="group" aria-label="Subtopics" className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium">Subtopics of {f.topics[0]}</span>
                <div className="flex flex-wrap gap-2">
                  {subtopicOptions.map((sub) => (
                    <Chip key={sub} tone="accent" on={f.subtopics.includes(sub)} onClick={() => toggleSubtopic(sub)}>
                      {sub}
                    </Chip>
                  ))}
                </div>
                <FieldError id="err-subtopics" message={errors.subtopics} />
              </div>
            ) : null}
            {stepItems.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Step reached</span>
                {stepItems.map((item) => (
                  <label key={item} className="flex flex-wrap items-center gap-3 text-[13px]">
                    <span className="min-w-40 font-semibold">{item}</span>
                    <select
                      value={f.stepsReached[item] ?? ""}
                      onChange={(e) => set("stepsReached", { ...f.stepsReached, [item]: e.target.value })}
                      aria-invalid={!!errors.stepsReached && !f.stepsReached[item]}
                      className={cn(input, "h-10 max-w-80 flex-1")}
                    >
                      <option value="">Pick the step…</option>
                      {stepOptions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} · {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <FieldError id="err-steps" message={errors.stepsReached} />
              </div>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <legend className="px-1.5 text-[13px] font-semibold">Questions asked · {f.picked.length + f.offRoadmap.length} selected</legend>
            {bank.length ? (
              <ul className="flex flex-col gap-1.5">
                {bank.map((q) => {
                  const on = f.picked.includes(q.title);
                  return (
                    <li key={q.title}>
                      <label className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm", on ? "border-accent-border bg-accent" : "border-border")}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => set("picked", on ? f.picked.filter((t) => t !== q.title) : [...f.picked, q.title])}
                          className="size-[18px] accent-primary"
                        />
                        <span className="flex-1 font-medium">{q.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {q.step} · {q.source}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">No roadmap questions for this selection yet. Add what you asked below.</p>
            )}
            <div className="flex flex-col gap-2 border-t border-dashed border-input pt-3">
              <span className="text-xs font-bold text-muted-foreground">Outside the roadmap</span>
              {f.offRoadmap.map((title) => (
                <div key={title} className="flex min-h-10 items-center gap-2.5 rounded-lg border border-warning-border bg-warning-soft pr-1 pl-3 text-sm">
                  <span className="flex-1 font-medium">{title}</span>
                  <span className="text-xs font-semibold text-warning">Off-roadmap · goes to admin review</span>
                  <button
                    type="button"
                    aria-label={`Remove ${title}`}
                    onClick={() => set("offRoadmap", f.offRoadmap.filter((t) => t !== title))}
                    className="flex size-9 items-center justify-center rounded-md text-warning hover:bg-card"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2">
                <label className={cn(label, "flex-[1_1_260px]")}>
                  Asked a question that isn&apos;t listed?
                  <input
                    value={draftOff}
                    onChange={(e) => setDraftOff(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOffRoadmap();
                      }
                    }}
                    placeholder="e.g. Trapping Rain Water, or a link"
                    className={input}
                  />
                </label>
                <Button type="button" variant="outline" className="h-11" onClick={addOffRoadmap} disabled={!draftOff.trim()}>
                  + Add question
                </Button>
              </div>
            </div>
            <label className={label}>
              Tweaked questions asked (optional)
              <textarea rows={2} value={f.tweakedQuestions} onChange={(e) => set("tweakedQuestions", e.target.value)} className={area} />
            </label>
            <FieldError id="err-questions" message={errors.questions} />
          </fieldset>

          <div className="flex flex-col gap-3">
            <div role="group" aria-label="Outcome" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Outcome</span>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Chip key={s} on={f.status === s} onClick={() => set("status", s)}>
                    {STATUS_LABEL[s]}
                  </Chip>
                ))}
              </div>
            </div>
            <div role="group" aria-label="Rating" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Rating · {f.rating} / 5</span>
              <div className="flex flex-wrap gap-1.5">
                {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={f.rating === r}
                    onClick={() => set("rating", r)}
                    className={cn(
                      "min-h-10 min-w-11 rounded-lg border text-[13px] font-semibold",
                      f.rating === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-sidebar-foreground hover:bg-muted",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={cn(label, "sm:col-span-2")}>
              Remarks
              <textarea rows={3} value={f.remarks} onChange={(e) => set("remarks", e.target.value)} aria-invalid={!!errors.remarks} aria-describedby="err-remarks" className={area} />
              <FieldError id="err-remarks" message={errors.remarks} />
            </label>
            <label className={label}>
              Performed well
              <textarea rows={2} value={f.performedWell} onChange={(e) => set("performedWell", e.target.value)} className={area} />
            </label>
            <label className={label}>
              Improvement areas
              <textarea rows={2} value={f.improvementAreas} onChange={(e) => set("improvementAreas", e.target.value)} className={area} />
            </label>
            <label className={cn(label, "sm:col-span-2")}>
              Action items
              <textarea rows={2} value={f.actionItems} onChange={(e) => set("actionItems", e.target.value)} className={area} />
            </label>
          </div>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <legend className="px-1.5 text-[13px] font-semibold">Recording & transcript</legend>
            <div className="flex flex-wrap gap-3">
              <label className={cn(label, "flex-[1_1_240px]")}>
                Transcript link
                <input type="url" value={f.transcriptUrl} onChange={(e) => set("transcriptUrl", e.target.value)} placeholder="https://… (shared Wispr Flow note or doc)" aria-invalid={!!errors.transcriptUrl} aria-describedby="err-turl" className={input} />
                <FieldError id="err-turl" message={errors.transcriptUrl} />
              </label>
              <label className={cn(label, "flex-[1_1_240px]")}>
                Meet recording link
                <input type="url" value={f.meetRecording} onChange={(e) => set("meetRecording", e.target.value)} placeholder="https://drive.google.com/…" aria-invalid={!!errors.meetRecording} aria-describedby="err-rec" className={input} />
                <FieldError id="err-rec" message={errors.meetRecording} />
              </label>
            </div>
            <label className={label}>
              <span className="flex flex-wrap justify-between gap-2">
                <span>Paste transcript (from Wispr Flow)</span>
                <span className="font-normal text-muted-foreground">{words ? `${words.toLocaleString("en-IN")} words` : "Nothing pasted yet"}</span>
              </span>
              <textarea
                rows={5}
                value={f.transcriptText}
                onChange={(e) => set("transcriptText", e.target.value)}
                placeholder="Paste the full transcript. It's saved with this interaction and shown on the student page. Staff only."
                className={cn(area, "font-mono text-xs leading-relaxed")}
              />
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground">Drafts save automatically in this browser.</span>
            <Button type="submit" size="lg" className="h-11 px-5 text-sm font-semibold" disabled={pending}>
              {pending ? "Saving…" : "Save interaction"}
            </Button>
          </div>
        </>
      ) : (
        <p className="rounded-lg bg-background px-4 py-6 text-center text-sm text-muted-foreground">
          Pick a student to start. Their attendance, last interaction and test results show here so you have context.
        </p>
      )}
    </form>
  );
}
