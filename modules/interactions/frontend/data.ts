/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/common/auth/roles";
import { authMode } from "@/common/auth/config";
import { getDb } from "@/common/db/pool";
import { getRosterStudent, invalidateRoster } from "@/common/data/roster";
import { expire, TAGS } from "@/common/data/cache";
import { cacheLife, cacheTag } from "next/cache";
import { callService } from "@/common/services/call";
import { todayIst } from "@/common/lib/dates";
import { INTERACTIONS_SERVICE } from "@nxtone/interactions-ui/service";
import { canLogFor, canLogForOthers } from "@nxtone/interactions-ui/lib/permissions";
import { interactionInput, STATUSES, type AskedQuestion, type Interaction, type InteractionInput, type InteractionStatus } from "@nxtone/interactions-ui/lib/types";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { subtopicNames, type Structure } from "@nxtone/interactions-ui/curriculum/lib/structure";
import { buildStudentDetail, SAMPLE_TODAY } from "@/common/sample-data/student-detail";
import { ROSTER } from "@/common/sample-data/roster";

/**
 * Interactions data access. With the database (WEB_DATABASE_URL set) logs are read from
 * logs.interactions and new ones are saved through the interactions service
 * (modules/interactions/backend), which applies the original app's rules. Without a
 * database, sample data lives in process memory so the flow still works in development.
 */

/** A question asked that isn't in the roadmap, with where the student was at the time. */
export type OffRoadmapEntry = { title: string; niatId: string; by: string; at: string; level: number; topic: string; subtopic: string | null };
type Store = { interactions: Interaction[]; offRoadmap: OffRoadmapEntry[] };

/** Sample entries so the curriculum review queue isn't empty in development. */
const SAMPLE_OFF_ROADMAP: OffRoadmapEntry[] = [
  ...["Karthik S.", "Karthik S.", "Neha P.", "Suresh M.", "Neha P."].map((by, i) => ({
    title: i === 2 ? "Trapping rain water" : "Trapping Rain Water",
    niatId: ["N99H01A0142", "N99H01A0098", "N99H01A0420", "N99H01A0311", "N99H01A0019"][i],
    by,
    at: `2026-11-0${2 + i}T15:00:00+05:30`,
    level: 1,
    topic: "Arrays",
    subtopic: "Prefix & Suffix sum",
  })),
  ...["Neha P.", "Divya R.", "Neha P."].map((by, i) => ({
    title: "Maximum Subarray Sum with One Deletion",
    niatId: ["N99H01A0420", "N99H01B0154", "N99H01A0019"][i],
    by,
    at: `2026-11-0${5 + i}T11:00:00+05:30`,
    level: 1,
    topic: "Arrays",
    subtopic: "Kadane's Algo",
  })),
  ...["Suresh M.", "Suresh M.", "Divya R.", "Karthik S."].map((by, i) => ({
    title: "Why is a hash map lookup O(1) on average?",
    niatId: ["N99H01A0311", "N99H01A0207", "N99H01B0087", "N99H01A0167"][i],
    by,
    at: `2026-10-2${8 + (i % 2)}T10:00:00+05:30`,
    level: 1,
    topic: "STL",
    subtopic: "Map / Unordered Map",
  })),
  { title: "Longest Consecutive Sequence", niatId: "N99H01B0087", by: "Divya R.", at: "2026-11-12T16:00:00+05:30", level: 1, topic: "Arrays", subtopic: "Array + Map / Set" },
];
const globalStore = globalThis as unknown as { __interactionStore?: Store };

function toIso(label: string) {
  const d = new Date(`${label} 12:00:00`);
  return Number.isNaN(d.getTime()) ? SAMPLE_TODAY.toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function seed(): Store {
  const interactions: Interaction[] = [];
  for (const student of ROSTER) {
    const detail = buildStudentDetail(student);
    for (const it of detail.interactions) {
      const level = Number(it.level.replace("L", "")) || 0;
      interactions.push({
        id: it.id,
        niatId: student.niatId,
        studentName: student.name,
        date: toIso(it.date),
        round: it.round,
        takenBy: it.by,
        assignedInstructor: student.instructor,
        level,
        topics: [it.topics.split(" › ")[0]],
        subtopics: it.topics.includes(" › ") ? [it.topics.split(" › ")[1]] : [],
        stepsReached: {},
        status: it.status === "Cleared" ? "Cleared" : "Need to Revisit",
        rating: it.rating,
        questions: it.questions.split(", ").map((title) => ({ title: title.replace(/ \((\d\.\d|off-roadmap)\)$/, ""), offRoadmap: title.includes("off-roadmap") })),
        tweakedQuestions: "",
        remarks: it.improvementAreas,
        performedWell: it.performedWell,
        improvementAreas: it.improvementAreas,
        actionItems: it.actionItems,
        meetRecording: "",
        transcriptUrl: "",
        transcriptText: "",
        createdBy: it.by,
        createdAt: `${toIso(it.date)}T12:00:00.000Z`,
      });
    }
  }
  interactions.sort((a, b) => b.date.localeCompare(a.date) || b.round - a.round);
  return { interactions, offRoadmap: [...SAMPLE_OFF_ROADMAP] };
}

function store(): Store {
  if (!globalStore.__interactionStore) globalStore.__interactionStore = seed();
  return globalStore.__interactionStore;
}

export async function listInteractions(filter: { instructor?: string; niatId?: string; niatIds?: string[]; limit?: number } = {}) {
  if (authMode() === "database") return dbListInteractions(filter);
  const only = filter.niatIds ? new Set(filter.niatIds) : null;
  const rows = store().interactions.filter(
    (it) => (!filter.instructor || it.assignedInstructor === filter.instructor) && (!filter.niatId || it.niatId === filter.niatId) && (!only || only.has(it.niatId)),
  );
  return filter.limit ? rows.slice(0, filter.limit) : rows;
}

export type CreateResult =
  | { ok: true; interaction: Interaction }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createInteraction(raw: unknown, user: SessionUser): Promise<CreateResult> {
  const parsed = interactionInput.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Some fields need attention.", fieldErrors };
  }
  const input: InteractionInput = parsed.data;
  if (authMode() === "database") return dbCreateInteraction(input, user);
  const student = ROSTER.find((s) => s.niatId === input.niatId);
  if (!student) return { ok: false, error: "That student isn't in the roster." };
  if (!canLogFor(user, student) && !(canLogForOthers(user) && input.takenBy === user.name)) {
    return { ok: false, error: "For a student who isn't yours, log what you took yourself: \"Taken by\" must be you." };
  }

  if (input.date > todayIst()) return { ok: false, error: "The date can't be in the future.", fieldErrors: { date: "Pick today or an earlier date" } };

  const s = store();
  const previous = s.interactions.filter((it) => it.niatId === input.niatId);
  const interaction: Interaction = {
    ...input,
    id: randomUUID(),
    studentName: student.name,
    round: Math.max(0, ...previous.map((it) => it.round)) + 1,
    assignedInstructor: student.instructor,
    createdBy: user.name,
    createdAt: new Date().toISOString(),
  };
  s.interactions.unshift(interaction);
  const where = placement(await getStructure(), input.level, input.topics, input.subtopics);
  for (const q of input.questions.filter((q) => q.offRoadmap)) {
    s.offRoadmap.push({
      title: q.title,
      niatId: input.niatId,
      by: user.name,
      at: interaction.createdAt,
      level: input.level,
      ...where,
    });
  }
  return { ok: true, interaction };
}

/** Every off-roadmap question logged, for the Curriculum review queue. */
export async function listOffRoadmapEntries(): Promise<OffRoadmapEntry[]> {
  if (authMode() === "database") return dbOffRoadmapEntries();
  return store().offRoadmap;
}

// ---------------------------------------------------------------- database

/*
 * logs.interactions keeps the original app's columns: topics / subtopics as comma-joined
 * text and the questions as free text, one per line. Questions logged from this app are
 * written one per line as "<n>. <title> (<step>)" or "<n>. <title> (off-roadmap)", so
 * they can be read back as structured questions; older free-text lines are kept as they are.
 */
const OFF_ROADMAP = /\s*\(off-roadmap\)\s*$/i;
const STEP_SUFFIX = /\s*\((\d\.\d)\)\s*$/;

export function parseQuestions(text: string): AskedQuestion[] {
  const out: AskedQuestion[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let title = raw.replace(/^\s*["“]?\s*(\d+\s*[.)]|[-*•])\s*/, "").trim();
    if (!title) continue;
    const offRoadmap = OFF_ROADMAP.test(title);
    title = title.replace(OFF_ROADMAP, "");
    const step = title.match(STEP_SUFFIX)?.[1];
    title = title.replace(STEP_SUFFIX, "").trim();
    if (title) out.push(step ? { title, step, offRoadmap } : { title, offRoadmap });
  }
  return out;
}

export function formatQuestions(questions: AskedQuestion[]): string {
  return questions
    .map((q, i) => `${i + 1}. ${q.title.trim()}${q.offRoadmap ? " (off-roadmap)" : q.step ? ` (${q.step})` : ""}`)
    .join("\n");
}

const splitList = (value: string | null) => (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

// Where an off-roadmap question is suggested to go: the first topic, and a subtopic only if it is one of that
// topic's (an interaction can cover several topics, so the first subtopic may belong to another one).
function placement(s: Structure, level: number, topics: string[], subtopics: string[]): { topic: string; subtopic: string | null } {
  const topic = topics[0] ?? "";
  const subs = subtopicNames(s, level, topic);
  return { topic, subtopic: subtopics.find((x) => subs.includes(x)) ?? null };
}

type DbRow = {
  id: string;
  niat_id: string;
  student_name: string;
  date: string;
  round: number;
  taken_by: string;
  assigned_instructor: string | null;
  level: number | null;
  topics: string;
  subtopics: string;
  steps_reached: Record<string, string> | null;
  status: string;
  rating: number;
  questions_asked: string;
  tweaked_questions: string;
  remarks: string;
  performed_well: string;
  improvement_areas: string;
  action_items: string;
  meet_recording: string;
  transcript: string | null;
  created_by: string | null;
  created_at: string;
};

function toInteraction(r: DbRow): Interaction {
  return {
    id: r.id,
    niatId: r.niat_id,
    studentName: r.student_name,
    date: r.date,
    round: r.round,
    takenBy: r.taken_by,
    assignedInstructor: r.assigned_instructor ?? "",
    level: r.level ?? 0,
    topics: splitList(r.topics),
    subtopics: splitList(r.subtopics),
    stepsReached: r.steps_reached ?? {},
    status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as InteractionStatus) : "In Progress",
    rating: Number(r.rating),
    questions: parseQuestions(r.questions_asked),
    tweakedQuestions: r.tweaked_questions,
    remarks: r.remarks,
    performedWell: r.performed_well,
    improvementAreas: r.improvement_areas,
    actionItems: r.action_items,
    meetRecording: r.meet_recording,
    transcriptUrl: "",
    transcriptText: r.transcript ?? "",
    createdBy: r.created_by ?? r.taken_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** Lists leave the (long) transcripts out; a single student's list includes them. */
function interactionSelect(withTranscript: boolean) {
  return `
    SELECT it.id, upper(it.student_id) AS niat_id, it.student_name, it.date::text AS date, it.interaction_round AS round,
           it.instructor_name AS taken_by, COALESCE(cur.name, it.assigned_instructor_name) AS assigned_instructor,
           it.level, it.topics, it.subtopics, it.steps_reached, it.status_post_interaction AS status, it.rating::float8 AS rating,
           it.questions_asked, it.tweaked_questions, it.remarks, it.performed_well, it.improvement_areas, it.action_items,
           it.meet_recording, ${withTranscript ? "it.granola_transcript" : "NULL"} AS transcript,
           COALESCE(u.name, it.created_by) AS created_by, it.created_at
    FROM logs.interactions it
    LEFT JOIN logs.users u ON u.id = it.created_by
    LEFT JOIN LATERAL (
      SELECT st.name FROM core.student_assignments a JOIN core.staff st ON st.id = a.staff_id
      WHERE a.niat_id = upper(it.student_id) AND a.kind = 'instructor' AND a.to_date IS NULL LIMIT 1
    ) cur ON true`;
}

async function dbListInteractions(filter: { instructor?: string; niatId?: string; niatIds?: string[]; limit?: number }): Promise<Interaction[]> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.interactions, ...(filter.niatId ? [TAGS.student(filter.niatId)] : []));
  const { rows } = await getDb().query<DbRow>(
    `${interactionSelect(!!filter.niatId)}
     WHERE ($1::text IS NULL OR cur.name = $1) AND ($2::text IS NULL OR upper(it.student_id) = $2)
       AND ($4::text[] IS NULL OR upper(it.student_id) = ANY($4::text[]))
     ORDER BY it.date DESC, it.created_at DESC
     LIMIT $3`,
    [filter.instructor ?? null, filter.niatId?.toUpperCase() ?? null, filter.limit ?? 100_000, filter.niatIds ?? null],
  );
  return rows.map(toInteraction);
}

async function dbCreateInteraction(input: InteractionInput, user: SessionUser): Promise<CreateResult> {
  const student = await getRosterStudent(input.niatId);
  if (!student) return { ok: false, error: "That student isn't in the roster." };
  if (!canLogFor(user, student) && !(canLogForOthers(user) && input.takenBy === user.name)) {
    return { ok: false, error: "For a student who isn't yours, log what you took yourself: \"Taken by\" must be you." };
  }
  if (input.date > todayIst()) return { ok: false, error: "The date can't be in the future.", fieldErrors: { date: "Pick today or an earlier date" } };

  const { rows } = await getDb().query<{ round: number; step: string | null; subtopic: string | null }>(
    `SELECT COALESCE((SELECT max(interaction_round) FROM logs.interactions WHERE upper(student_id) = $1), 0)::int + 1 AS round,
            s.current_step AS step, s.current_subtopic AS subtopic
     FROM logs.students s WHERE upper(s.id) = $1`,
    [input.niatId],
  );
  const current = rows[0];
  if (!current) return { ok: false, error: "That student has no Interactions record yet." };

  const questionsAsked = formatQuestions(input.questions) || input.tweakedQuestions.trim();
  const transcript = [input.transcriptUrl ? `Transcript: ${input.transcriptUrl}` : "", input.transcriptText.trim()].filter(Boolean).join("\n\n");
  const id = randomUUID();
  const result = await callService<{ interaction: { interactionRound: number } }>(INTERACTIONS_SERVICE, user, "POST", "/interactions", {
    id,
    studentId: student.niatId,
    studentName: student.name,
    instructorName: input.takenBy,
    instructorEmail: input.takenBy === user.name ? user.email : undefined,
    assignedInstructorName: student.instructor,
    topics: input.topics.join(", "),
    subtopics: input.subtopics.join(", "),
    stepsReached: input.stepsReached,
    statusPostInteraction: input.status,
    rating: input.rating,
    questionsAsked,
    remarks: input.remarks,
    performedWell: input.performedWell,
    improvementAreas: input.improvementAreas,
    tweakedQuestions: input.tweakedQuestions,
    actionItems: input.actionItems,
    meetRecording: input.meetRecording,
    granolaTranscript: transcript,
    interactionRound: current.round,
    level: `Level ${input.level}`,
    currentStep: current.step ?? undefined,
    currentSubtopic: current.subtopic,
    date: input.date,
  });
  if (!result.ok) return { ok: false, error: result.error };
  invalidateRoster(student.niatId);
  expire(TAGS.interactions);

  const saved = await getDb().query<DbRow>(`${interactionSelect(false)} WHERE it.id = $1`, [id]);
  const row = saved.rows[0];
  return row ? { ok: true, interaction: toInteraction(row) } : { ok: false, error: "Saved, but it couldn't be read back. Refresh the page." };
}

async function dbOffRoadmapEntries(): Promise<OffRoadmapEntry[]> {
  const { rows } = await getDb().query<{ niat_id: string; by: string; created_at: string; level: number | null; topics: string; subtopics: string; questions_asked: string }>(
    `SELECT upper(student_id) AS niat_id, instructor_name AS by, created_at, level, topics, subtopics, questions_asked
     FROM logs.interactions WHERE questions_asked ILIKE '%(off-roadmap)%'`,
  );
  const structure = await getStructure();
  return rows.flatMap((r) =>
    parseQuestions(r.questions_asked)
      .filter((q) => q.offRoadmap)
      .map((q) => ({
        title: q.title,
        niatId: r.niat_id,
        by: r.by,
        at: new Date(r.created_at).toISOString(),
        level: r.level ?? 0,
        ...placement(structure, r.level ?? 0, splitList(r.topics), splitList(r.subtopics)),
      })),
  );
}
