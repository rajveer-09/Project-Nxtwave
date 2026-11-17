/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomUUID } from "node:crypto";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import { listOffRoadmapEntries } from "@/modules/interactions/data";
import { getStepOptionsForTopic, getSubtopicOptions, getTopicOptions, LEVELS, REACHED_STEPS } from "@/modules/interactions/lib/curriculum";
import { bankKey, QUESTION_BANK, type BankQuestion } from "@/modules/interactions/lib/question-bank";

/**
 * Curriculum and question bank (ARCHITECTURE §4.5). The roadmap structure
 * (levels → topics → subtopics) comes from the Interactions app's curriculum;
 * the questions live here and are editable. In memory for development; with the
 * database this is logs.questions + logs.off_roadmap_questions.
 */

export type Question = {
  id: string;
  level: number;
  topic: string;
  subtopic: string | null;
  step: string;
  title: string;
  source: string;
  url: string;
  notes: string;
  tweakOf: string | null;
  origin: "roadmap" | "promoted";
  createdBy: string;
  archived: boolean;
};

export type Decision = { status: "added" | "kept" | "dismissed"; by: string; at: string; questionId?: string };

type Store = { questions: Question[]; decisions: Map<string, Decision> };
const g = globalThis as unknown as { __curriculumStore?: Store };

function seed(): Store {
  const questions: Question[] = [];
  for (const [key, list] of Object.entries(QUESTION_BANK)) {
    const [levelName, topic, subtopic] = key.split("|");
    for (const q of list) {
      questions.push({
        id: randomUUID().slice(0, 8),
        level: LEVELS.indexOf(levelName),
        topic,
        subtopic: subtopic ?? null,
        step: q.step,
        title: q.title,
        source: q.source,
        url: "",
        notes: "",
        tweakOf: null,
        origin: "roadmap",
        createdBy: "Imported from the Interactions app",
        archived: false,
      });
    }
  }
  return { questions, decisions: new Map() };
}
const store = () => (g.__curriculumStore ??= seed());

/** Roadmap structure for the admin screen: levels → topics → subtopics, plus the steps each topic uses. */
export function roadmap() {
  return LEVELS.map((name, level) => ({
    level,
    name,
    topics: getTopicOptions(name).map((topic) => ({
      topic,
      subtopics: getSubtopicOptions(name, topic),
      steps: level === 0 ? [] : REACHED_STEPS.filter((s) => getStepOptionsForTopic(name, topic).some((o) => o.startsWith(s.code))),
    })),
  }));
}

export async function listQuestions(includeArchived = false) {
  return store().questions.filter((q) => includeArchived || !q.archived);
}

/** The live bank in the shape the Interactions form uses. */
export async function questionBank(): Promise<Record<string, BankQuestion[]>> {
  const bank: Record<string, BankQuestion[]> = {};
  for (const q of await listQuestions()) {
    const key = bankKey(LEVELS[q.level], q.topic, q.subtopic);
    (bank[key] ??= []).push({ title: q.title, step: q.step, source: q.source || (q.origin === "promoted" ? "Added from review" : "") });
  }
  return bank;
}

type Fail = { ok: false; error: string };

export type QuestionInput = { level: number; topic: string; subtopic: string | null; step: string; title: string; source: string; url: string; notes: string; tweakOf: string | null };

function placementError(input: Pick<QuestionInput, "level" | "topic" | "subtopic" | "step">): string | null {
  const levelName = LEVELS[input.level];
  if (!levelName) return "Unknown level.";
  if (!getTopicOptions(levelName).includes(input.topic)) return "That topic isn't in this level.";
  const subs = getSubtopicOptions(levelName, input.topic);
  if (subs.length && (!input.subtopic || !subs.includes(input.subtopic))) return "Pick one of this topic's subtopics.";
  if (!subs.length && input.subtopic) return "This topic has no subtopics.";
  if (input.level > 0 && !REACHED_STEPS.some((s) => s.code === input.step)) return "Pick a step.";
  return null;
}

export async function addQuestion(user: SessionUser, input: QuestionInput): Promise<{ ok: true; question: Question } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins change the curriculum." };
  const problem = placementError(input);
  if (problem) return { ok: false, error: problem };
  if (!input.title.trim()) return { ok: false, error: "Give the question a title." };
  if (input.url && !/^https:\/\/\S+$/i.test(input.url)) return { ok: false, error: "Links must start with https://" };
  const dupe = store().questions.find(
    (q) => !q.archived && q.level === input.level && q.topic === input.topic && q.subtopic === input.subtopic && q.title.trim().toLowerCase() === input.title.trim().toLowerCase(),
  );
  if (dupe) return { ok: false, error: "That question is already in this place." };
  const question: Question = { ...input, title: input.title.trim(), id: randomUUID().slice(0, 8), origin: "roadmap", createdBy: user.name, archived: false };
  store().questions.push(question);
  return { ok: true, question };
}

export async function setArchived(user: SessionUser, id: string, archived: boolean): Promise<{ ok: true } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins change the curriculum." };
  const q = store().questions.find((x) => x.id === id);
  if (!q) return { ok: false, error: "Question not found." };
  q.archived = archived;
  return { ok: true };
}

// ---------- off-roadmap review queue

/** Same question asked by different instructors is grouped by its normalised title. */
export const normaliseTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/https?:\/\/leetcode\.com\/problems\/([a-z0-9-]+).*/, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type QueueItem = {
  key: string;
  title: string;
  times: number;
  instructors: string[];
  firstAsked: string;
  firstBy: string;
  suggested: { level: number; topic: string; subtopic: string | null };
  decision: Decision | null;
};

export async function offRoadmapQueue(): Promise<QueueItem[]> {
  const groups = new Map<string, QueueItem>();
  const places = new Map<string, Map<string, number>>();
  for (const e of await listOffRoadmapEntries()) {
    const key = normaliseTitle(e.title);
    if (!key) continue;
    const g = groups.get(key);
    const place = JSON.stringify({ level: e.level, topic: e.topic, subtopic: e.subtopic });
    const counts = places.get(key) ?? new Map<string, number>();
    counts.set(place, (counts.get(place) ?? 0) + 1);
    places.set(key, counts);
    if (!g) {
      groups.set(key, { key, title: e.title, times: 1, instructors: [e.by], firstAsked: e.at, firstBy: e.by, suggested: { level: e.level, topic: e.topic, subtopic: e.subtopic }, decision: null });
    } else {
      g.times++;
      if (!g.instructors.includes(e.by)) g.instructors.push(e.by);
      if (e.at < g.firstAsked) Object.assign(g, { firstAsked: e.at, firstBy: e.by });
    }
  }
  for (const g of groups.values()) {
    // Suggest the place it was asked most often.
    const best = [...places.get(g.key)!.entries()].sort((a, b) => b[1] - a[1])[0][0];
    g.suggested = JSON.parse(best);
    g.decision = store().decisions.get(g.key) ?? null;
  }
  return [...groups.values()].sort((a, b) => Number(!!a.decision) - Number(!!b.decision) || b.times - a.times);
}

export async function decide(
  user: SessionUser,
  key: string,
  action: "added" | "kept" | "dismissed",
  placement?: { level: number; topic: string; subtopic: string | null; step: string },
): Promise<{ ok: true } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins review off-roadmap questions." };
  const item = (await offRoadmapQueue()).find((q) => q.key === key);
  if (!item) return { ok: false, error: "That question isn't in the queue." };
  if (item.decision) return { ok: false, error: "Already decided. Undo first to change it." };
  let questionId: string | undefined;
  if (action === "added") {
    if (!placement) return { ok: false, error: "Pick where it goes in the roadmap." };
    const result = await addQuestion(user, { ...placement, title: item.title, source: "Added from review", url: "", notes: `Asked ${item.times}× by ${item.instructors.join(", ")}`, tweakOf: null });
    if (!result.ok) return result;
    result.question.origin = "promoted";
    questionId = result.question.id;
  }
  store().decisions.set(key, { status: action, by: user.name, at: new Date().toISOString(), questionId });
  return { ok: true };
}

export async function undoDecision(user: SessionUser, key: string): Promise<{ ok: true } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins review off-roadmap questions." };
  const d = store().decisions.get(key);
  if (!d) return { ok: false, error: "Nothing to undo." };
  if (d.questionId) store().questions = store().questions.filter((q) => q.id !== d.questionId);
  store().decisions.delete(key);
  return { ok: true };
}
