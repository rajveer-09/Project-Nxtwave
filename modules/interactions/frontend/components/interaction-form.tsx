/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use client";

import { ChevronDown, ChevronRight, ClipboardPaste, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { logInteraction } from "@nxtone/interactions-ui/actions";
import { Button } from "@/common/ui/button";
import { QuestionTitle } from "@nxtone/interactions-ui/curriculum/components/question-title";
import { liveTopics, reachedSteps, subtopicNames, topicNames, type Structure } from "@nxtone/interactions-ui/curriculum/lib/structure";
import { clearInteractionDraft, interactionDraftKey, loadInteractionDraft, saveInteractionDraft } from "@nxtone/interactions-ui/lib/draft";
import { blockKeyboardSubmit } from "@nxtone/interactions-ui/lib/forms";
import { questionsFor, type BankQuestion, type CoveredItem } from "@nxtone/interactions-ui/lib/question-bank";
import { parseSheetRow } from "@nxtone/interactions-ui/lib/sheet-row-parser";
import { interactionInput, STATUSES, STATUS_LABEL, type InteractionStatus } from "@nxtone/interactions-ui/lib/types";
import { cn } from "@/common/lib/utils";

export type FormStudent = {
  niatId: string;
  name: string;
  group: string;
  level: number;
  topic: string;
  subtopic: string | null;
  attendance30d: number | null;
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

const stepKey = (item: string, code: string) => `${item}|${code}`;

/** Adds (on) or removes the keys from a set, returning a new set. */
function toggleKeys(prev: Set<string>, keys: string[], on: boolean): Set<string> {
  const next = new Set(prev);
  for (const k of keys) {
    if (on) next.add(k);
    else next.delete(k);
  }
  return next;
}

/**
 * One subtopic's (or topic's) roadmap questions, grouped into collapsible rows by step
 * ("2.1 · Easy standard question", ticked/total). Steps with no questions are left out.
 */
function StepGroups({
  title,
  heading = title,
  questions,
  steps,
  picked,
  open,
  onToggleOpen,
  onTogglePick,
}: {
  /** The subtopic or topic name; keys the open step rows. */
  title: string;
  /** Shown above the rows; defaults to the title. */
  heading?: string;
  questions: (BankQuestion & { where: string })[];
  steps: { code: string; label: string }[];
  picked: string[];
  open: Set<string>;
  onToggleOpen: (keys: string[], on: boolean) => void;
  onTogglePick: (title: string) => void;
}) {
  // The whole block can be folded to its heading, so several subtopics don't crowd the form.
  const [folded, setFolded] = useState(false);
  // Curriculum step order first; a question at a step the curriculum doesn't list still shows, by its code.
  const known = new Set(steps.map((s) => s.code));
  const extra = [...new Set(questions.map((q) => q.step).filter((c) => !known.has(c)))].sort().map((code) => ({ code, label: "" }));
  // Level 0 has no steps: its questions sit in one "Questions" row (as on the Curriculum page).
  const groups = steps.length
    ? [...steps, ...extra].map((s) => ({ ...s, questions: questions.filter((q) => q.step === s.code) })).filter((g) => g.questions.length)
    : questions.length
      ? [{ code: "", label: "Questions", questions }]
      : [];
  if (!groups.length) {
    return (
      <section aria-label={`${heading} questions`} className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{heading} — Questions</h3>
        <p className="text-[13px] text-muted-foreground">No roadmap questions here yet. Add what you asked below.</p>
      </section>
    );
  }

  const keys = groups.map((g) => stepKey(title, g.code));
  const allOpen = keys.every((k) => open.has(k));
  const tickedHere = questions.filter((q) => picked.includes(q.title)).length;

  return (
    <section aria-label={`${heading} questions`} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          <button
            type="button"
            aria-expanded={!folded}
            onClick={() => setFolded(!folded)}
            className="-ml-1.5 flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-left hover:bg-muted"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", folded && "-rotate-90")} />
            {heading} — Questions
            {/* When folded, still show how many were ticked here. */}
            {folded ? (
              <span className={cn("ml-1 text-xs font-normal tabular", tickedHere ? "text-primary" : "text-muted-foreground")}>
                {tickedHere}/{questions.length} selected
              </span>
            ) : null}
          </button>
        </h3>
        {!folded ? (
          <button type="button" onClick={() => onToggleOpen(keys, !allOpen)} className="min-h-8 rounded-full border border-input px-3 text-xs font-semibold hover:bg-muted">
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
      </div>
      <ul hidden={folded} className="flex flex-col gap-2">
        {groups.map((g) => {
          const key = stepKey(title, g.code);
          const isOpen = open.has(key);
          const ticked = g.questions.filter((q) => picked.includes(q.title)).length;
          return (
            <li key={g.code} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => onToggleOpen([key], !isOpen)}
                className={cn("flex min-h-12 w-full items-center gap-2.5 px-3.5 text-left text-sm font-semibold hover:bg-muted", isOpen && "border-b border-border")}
              >
                <ChevronRight aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
                <span className="flex-1">
                  {/* "2.1 · Easy standard question"; Level 0's single row is just "Questions". */}
                  {[g.code, g.label].filter(Boolean).join(" · ")}
                </span>
                <span className={cn("text-xs tabular", ticked ? "text-primary" : "text-muted-foreground")}>
                  {ticked}/{g.questions.length}
                </span>
              </button>
              {isOpen ? (
                <ul className="flex flex-col py-1.5">
                  {g.questions.map((q) => {
                    const on = picked.includes(q.title);
                    return (
                      <li key={q.title}>
                        <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3.5 text-sm hover:bg-muted", on && "bg-accent")}>
                          {/* Round tick-box, as in the design: an outlined circle, filled with a ring when ticked. */}
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => onTogglePick(q.title)}
                            className="size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-foreground checked:border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3px_var(--card)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          />
                          <span className="flex-1">
                            <QuestionTitle title={q.title} url={q.url} className="font-normal" />
                          </span>
                          {q.source ? <span className="text-xs text-muted-foreground">{q.source}</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
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
  structure,
  fixedTakenBy,
}: {
  /**
   * Logging for another instructor's student (the Log interaction page): "Taken by" is always the
   * person logging, the student is the one they looked up, and the context from other modules
   * (attendance, tests, contests, the student page) is not shown.
   */
  fixedTakenBy?: string;
  /** Live question bank from the Curriculum module, keyed by bankKey(). */
  questionBank: Record<string, BankQuestion[]>;
  /** The roadmap's levels, topics, subtopics and steps (Curriculum module). */
  structure: Structure;
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
  // "Taken by" is not filled in from the signed-in user (rule carried over from the Interactions app),
  // except on the Log interaction page, where it is always the person logging.
  const takenByStart = fixedTakenBy ?? "";
  const [f, setF] = useState<Fields>(() => blankFields(student, today, takenByStart));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftOff, setDraftOff] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteWarnings, setPasteWarnings] = useState<string[]>([]);
  // Which step rows are expanded in "Questions asked", keyed by stepKey(subtopic or topic, step code).
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => new Set());
  const loadedKey = useRef<string | null>(null);

  const draftKey = niatId ? interactionDraftKey(userId, { studentId: niatId }) : null;
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((prev) => ({ ...prev, [key]: value }));

  // Restore a saved draft when a student is picked.
  useEffect(() => {
    if (!draftKey || loadedKey.current === draftKey) return;
    loadedKey.current = draftKey;
    const draft = loadInteractionDraft<Fields>(draftKey);
    setF(draft ? { ...blankFields(student, today, takenByStart), ...draft.fields, ...(fixedTakenBy ? { takenBy: fixedTakenBy } : {}) } : blankFields(student, today, takenByStart));
    setDraftNotice(draft ? new Date(draft.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null);
    setErrors({});
  }, [draftKey, student, today, takenByStart, fixedTakenBy]);

  // Keep the draft up to date (after the first load for this student).
  useEffect(() => {
    if (!draftKey || loadedKey.current !== draftKey) return;
    const untouched = JSON.stringify(f) === JSON.stringify(blankFields(student, today, takenByStart));
    const t = setTimeout(() => (untouched ? clearInteractionDraft(draftKey) : saveInteractionDraft(draftKey, f)), 400);
    return () => clearTimeout(t);
  }, [draftKey, f, student, today, takenByStart]);

  const level = levelName(f.level);
  const levelOptions = structure.levels.filter((l) => l.level === f.level || liveTopics(structure, l.level).length);
  const topicOptions = topicNames(structure, f.level);
  // One topic per interaction. A topic with subtopics is covered through the subtopics picked for it;
  // a topic without subtopics is covered as itself. Steps and questions are per covered item.
  const subsOf = (topic: string) => subtopicNames(structure, f.level, topic);
  const topicsWithSubs = f.topics.filter((t) => subsOf(t).length > 0);
  const covered: CoveredItem[] = f.topics.flatMap<CoveredItem>((t) => {
    const subs = subsOf(t);
    return subs.length ? subs.filter((s) => f.subtopics.includes(s)).map((s) => ({ topic: t, subtopic: s })) : [{ topic: t, subtopic: null }];
  });
  const itemName = (c: CoveredItem) => c.subtopic ?? c.topic;
  const whereOf = (c: CoveredItem) => (c.subtopic ? `${c.topic} › ${c.subtopic}` : c.topic);
  const missingSubs = topicsWithSubs.filter((t) => !subsOf(t).some((s) => f.subtopics.includes(s)));
  const stepOptions = reachedSteps(structure, f.level);
  const bank = questionsFor(level, covered, questionBank);
  // Step reached isn't asked any more (2026-11-19): it is the highest step among the questions ticked for each
  // subtopic (or topic without subtopics). Items with nothing ticked get no step. Level 0 has no steps.
  const stepRankOf = (code: string) => stepOptions.findIndex((s) => s.code === code);
  const stepsReached: Record<string, string> = {};
  if (stepOptions.length) {
    for (const c of covered) {
      const codes = bank.filter((q) => q.where === whereOf(c) && f.picked.includes(q.title) && stepRankOf(q.step) >= 0).map((q) => q.step);
      if (codes.length) stepsReached[itemName(c)] = codes.reduce((a, b) => (stepRankOf(b) > stepRankOf(a) ? b : a));
    }
  }
  const words = f.transcriptText.trim() ? f.transcriptText.trim().split(/\s+/).length : 0;

  function changeLevel(n: number) {
    const first = topicNames(structure, n)[0];
    setF((prev) => ({ ...prev, level: n, topics: first ? [first] : [], subtopics: [], picked: [] }));
  }
  // One topic per interaction (user, 2026-11-19): picking a topic replaces the current one and drops the old
  // topic's subtopics. Picking the selected topic again keeps it, since a topic is required.
  function selectTopic(topic: string) {
    setF((prev) => {
      if (prev.topics.length === 1 && prev.topics[0] === topic) return prev;
      const subs = subtopicNames(structure, prev.level, topic);
      return { ...prev, topics: [topic], subtopics: prev.subtopics.filter((s) => subs.includes(s)) };
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
      takenBy: !fixedTakenBy && v.takenByName && instructors.includes(v.takenByName) ? v.takenByName : prev.takenBy,
      // One topic per interaction: a sheet row naming several keeps the first (warned below).
      topics: v.topics?.length ? [v.topics[0]] : prev.topics,
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
    if (v.topics && v.topics.length > 1) warnings.push(`The sheet lists ${v.topics.join(", ")}. An interaction covers one topic, so only ${v.topics[0]} was picked; log the others separately.`);
    if (!fixedTakenBy && v.takenByName && !instructors.includes(v.takenByName)) warnings.push(`"${v.takenByName}" isn't in the instructor list. Pick "Taken by" by hand.`);
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
      subtopics: covered.flatMap((c) => (c.subtopic ? [c.subtopic] : [])),
      stepsReached,
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
    if (missingSubs.length) next.subtopics = `Pick the subtopic(s) covered for ${missingSubs.join(", ")}`;
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
      className="flex min-w-0 flex-[1_1_440px] flex-col gap-5 rounded-xl border border-border bg-card p-5"
      noValidate
    >
      <div className="flex flex-wrap gap-3">
        {fixedTakenBy ? (
          <div className={cn(label, "flex-[2_1_240px]")}>
            Student
            <span className="flex h-11 items-center rounded-lg border border-input bg-background px-3 text-sm font-semibold">
              {student ? `${student.name} · ${student.niatId}` : "—"}
            </span>
          </div>
        ) : (
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
        )}
        <label className={cn(label, "flex-[1_1_150px]")}>
          Date
          <input type="date" value={f.date} max={today} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} aria-describedby="err-date" className={input} />
          <FieldError id="err-date" message={errors.date} />
        </label>
        {fixedTakenBy ? (
          <div className={cn(label, "flex-[1_1_170px]")}>
            Taken by
            <span className="flex h-11 items-center rounded-lg border border-input bg-background px-3 text-sm font-semibold">{fixedTakenBy} (you)</span>
          </div>
        ) : (
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
        )}
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
                  setF(blankFields(student, today, takenByStart));
                  setDraftNotice(null);
                }}
                className="min-h-8 rounded-md px-2 font-semibold underline-offset-2 hover:underline"
              >
                Discard draft
              </button>
            </div>
          ) : null}

          {fixedTakenBy ? null : (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg bg-background px-3.5 py-3 text-[13px] text-sidebar-foreground">
            <span className="w-full font-semibold text-foreground">From other modules · {student.group}</span>
            <span>
              Attendance 30d: <b className={cn(student.attendance30d !== null && student.attendance30d < 75 && "text-warning")}>{student.attendance30d === null ? "—" : `${student.attendance30d}%`}</b>
            </span>
            <span>Last interaction: {student.lastInteractionLabel ?? "none yet"}</span>
            <span>Latest weekly test: {student.latestTest !== null ? `${student.latestTest} / 50` : "—"}</span>
            <span>Contests: {student.contestAbsentStreak >= 3 ? <b className="text-warning">absent last {student.contestAbsentStreak}</b> : "attending"}</span>
            <a href={`/students/${student.niatId}`} className="font-semibold text-primary hover:text-accent-strong">
              Open student page →
            </a>
          </div>
          )}

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
                {levelOptions.map((l) => (
                  <option key={l.level} value={l.level}>
                    {levelName(l.level)}
                    {l.title ? ` · ${l.title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Topic" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Topic <span className="font-normal text-muted-foreground">· one per interaction</span></span>
              <div className="flex flex-wrap gap-2">
                {topicOptions.map((topic) => (
                  <Chip key={topic} on={f.topics.includes(topic)} onClick={() => selectTopic(topic)}>
                    {topic}
                  </Chip>
                ))}
              </div>
              <FieldError id="err-topics" message={errors.topics} />
            </div>
            {topicsWithSubs.length ? (
              <div className="flex flex-col gap-3">
                {/* The picked topic's subtopic chips (an interaction covers one topic). */}
                {topicsWithSubs.map((topic) => (
                  <div key={topic} role="group" aria-label={`Subtopics of ${topic}`} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium">Subtopics of {topic}</span>
                    <div className="flex flex-wrap gap-2">
                      {subsOf(topic).map((sub) => (
                        <Chip key={sub} tone="accent" on={f.subtopics.includes(sub)} onClick={() => toggleSubtopic(sub)}>
                          {sub}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
                <FieldError id="err-subtopics" message={errors.subtopics} />
              </div>
            ) : null}
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
            {/* Count only ticks on questions shown now; ticks under a subtopic that was unticked aren't saved. */}
            <legend className="px-1.5 text-[13px] font-semibold">Questions asked · {bank.filter((q) => f.picked.includes(q.title)).length + f.offRoadmap.length} selected</legend>
            {missingSubs.length ? (
              <p className="text-[13px] text-muted-foreground">Pick a subtopic of {missingSubs.join(" and ")} above to see its questions.</p>
            ) : null}
            {bank.length ? (
              <div className="flex flex-col gap-5">
                {covered.map((c) => (
                  <StepGroups
                    key={itemName(c)}
                    title={itemName(c)}
                    // "Maths › Digit Manipulation", so the heading names the topic too.
                    heading={whereOf(c)}
                    questions={bank.filter((q) => q.where === whereOf(c))}
                    steps={stepOptions}
                    picked={f.picked}
                    open={openSteps}
                    onToggleOpen={(keys, on) => setOpenSteps((prev) => toggleKeys(prev, keys, on))}
                    onTogglePick={(title) => set("picked", f.picked.includes(title) ? f.picked.filter((t) => t !== title) : [...f.picked, title])}
                  />
                ))}
              </div>
            ) : covered.length ? (
              <p className="text-[13px] text-muted-foreground">No roadmap questions for this selection yet. Add what you asked below.</p>
            ) : null}
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
