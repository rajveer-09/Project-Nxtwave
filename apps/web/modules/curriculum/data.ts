/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { authMode } from "@/common/auth/config";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";
import { listOffRoadmapEntries } from "@/modules/interactions/data";
import { getStepOptionsForTopic, getSubtopicOptions, getTopicOptions, LEVELS, REACHED_STEPS } from "@/modules/interactions/lib/curriculum";
import { bankKey, QUESTION_BANK, type BankQuestion } from "@/modules/interactions/lib/question-bank";

/**
 * Curriculum and question bank (ARCHITECTURE §4.5). The roadmap structure
 * (levels → topics → subtopics) comes from the Interactions app's curriculum;
 * the questions are editable. With the database: core.curriculum_questions and
 * core.off_roadmap_decisions (the questions imported from the Interactions app are
 * added on first use). Without it, an in-memory sample for development.
 */

const fromDb = () => authMode() === "database";

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

// ---------------------------------------------------------------- database

type QuestionRow = {
  id: string;
  level: number;
  topic: string;
  subtopic: string | null;
  step: string;
  title: string;
  source: string;
  url: string;
  notes: string;
  tweak_of: string | null;
  origin: "roadmap" | "promoted";
  created_by: string;
  archived: boolean;
};
const toQuestion = (r: QuestionRow): Question => ({
  id: r.id,
  level: r.level,
  topic: r.topic,
  subtopic: r.subtopic,
  step: r.step,
  title: r.title,
  source: r.source,
  url: r.url,
  notes: r.notes,
  tweakOf: r.tweak_of,
  origin: r.origin,
  createdBy: r.created_by,
  archived: r.archived,
});

const seeded = globalThis as unknown as { __curriculumSeeded?: Promise<void> };

/** Adds the Interactions app's question bank once. Ids are derived from the question, so re-running adds nothing. */
function ensureSeeded(): Promise<void> {
  seeded.__curriculumSeeded ??= (async () => {
    const rows = seed().questions.map((q) => ({
      ...q,
      id: `bank-${createHash("sha1").update(`${q.level}|${q.topic}|${q.subtopic ?? ""}|${q.step}|${q.title}`).digest("hex").slice(0, 12)}`,
    }));
    await getDb().query(
      `INSERT INTO core.curriculum_questions (id, level, topic, subtopic, step, title, source, origin, created_by)
       SELECT x.id, x.level, x.topic, x.subtopic, x.step, x.title, x.source, 'roadmap', x."createdBy"
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, level smallint, topic text, subtopic text, step text, title text, source text, "createdBy" text)
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(rows)],
    );
  })().catch((err) => {
    seeded.__curriculumSeeded = undefined;
    throw err;
  });
  return seeded.__curriculumSeeded;
}

async function dbQuestions(includeArchived: boolean): Promise<Question[]> {
  await ensureSeeded();
  const { rows } = await getDb().query<QuestionRow>(
    `SELECT id, level, topic, subtopic, step, title, source, url, notes, tweak_of, origin, created_by, archived
     FROM core.curriculum_questions WHERE $1 OR NOT archived ORDER BY level, topic, subtopic NULLS FIRST, step, created_at, title`,
    [includeArchived],
  );
  return rows.map(toQuestion);
}

async function insertQuestion(q: Question) {
  if (!fromDb()) {
    store().questions.push(q);
    return;
  }
  await getDb().query(
    `INSERT INTO core.curriculum_questions (id, level, topic, subtopic, step, title, source, url, notes, tweak_of, origin, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [q.id, q.level, q.topic, q.subtopic, q.step, q.title, q.source, q.url, q.notes, q.tweakOf, q.origin, q.createdBy],
  );
}

async function getDecision(key: string): Promise<Decision | null> {
  if (!fromDb()) return store().decisions.get(key) ?? null;
  const { rows } = await getDb().query<{ status: Decision["status"]; decided_by: string; decided_at: string; question_id: string | null }>(
    "SELECT status, decided_by, decided_at, question_id FROM core.off_roadmap_decisions WHERE key = $1",
    [key],
  );
  const r = rows[0];
  return r ? { status: r.status, by: r.decided_by, at: new Date(r.decided_at).toISOString(), questionId: r.question_id ?? undefined } : null;
}

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
  if (fromDb()) return dbQuestions(includeArchived);
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

export async function addQuestion(user: SessionUser, input: QuestionInput, origin: Question["origin"] = "roadmap"): Promise<{ ok: true; question: Question } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins change the curriculum." };
  const problem = placementError(input);
  if (problem) return { ok: false, error: problem };
  if (!input.title.trim()) return { ok: false, error: "Give the question a title." };
  if (input.url && !/^https:\/\/\S+$/i.test(input.url)) return { ok: false, error: "Links must start with https://" };
  const dupe = (await listQuestions()).find(
    (q) => !q.archived && q.level === input.level && q.topic === input.topic && q.subtopic === input.subtopic && q.title.trim().toLowerCase() === input.title.trim().toLowerCase(),
  );
  if (dupe) return { ok: false, error: "That question is already in this place." };
  const question: Question = { ...input, title: input.title.trim(), id: randomUUID().slice(0, 8), origin, createdBy: user.name, archived: false };
  await insertQuestion(question);
  return { ok: true, question };
}

export async function setArchived(user: SessionUser, id: string, archived: boolean): Promise<{ ok: true } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins change the curriculum." };
  if (fromDb()) {
    const { rows } = await getDb().query("UPDATE core.curriculum_questions SET archived = $2 WHERE id = $1 RETURNING id", [id, archived]);
    return rows.length ? { ok: true } : { ok: false, error: "Question not found." };
  }
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
    g.decision = await getDecision(g.key);
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
    const result = await addQuestion(user, { ...placement, title: item.title, source: "Added from review", url: "", notes: `Asked ${item.times}× by ${item.instructors.join(", ")}`, tweakOf: null }, "promoted");
    if (!result.ok) return result;
    questionId = result.question.id;
  }
  if (fromDb()) {
    await getDb().query(
      "INSERT INTO core.off_roadmap_decisions (key, status, decided_by, question_id) VALUES ($1, $2, $3, $4)",
      [key, action, user.name, questionId ?? null],
    );
  } else {
    store().decisions.set(key, { status: action, by: user.name, at: new Date().toISOString(), questionId });
  }
  return { ok: true };
}

export async function undoDecision(user: SessionUser, key: string): Promise<{ ok: true } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only admins review off-roadmap questions." };
  const d = await getDecision(key);
  if (!d) return { ok: false, error: "Nothing to undo." };
  if (fromDb()) {
    await getDb().query(
      `WITH d AS (DELETE FROM core.off_roadmap_decisions WHERE key = $1 RETURNING question_id)
       DELETE FROM core.curriculum_questions WHERE id IN (SELECT question_id FROM d) AND origin = 'promoted'`,
      [key],
    );
    return { ok: true };
  }
  if (d.questionId) store().questions = store().questions.filter((q) => q.id !== d.questionId);
  store().decisions.delete(key);
  return { ok: true };
}
