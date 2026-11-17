/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/common/auth/roles";
import { todayIst } from "@/common/lib/dates";
import { canLogFor } from "@/modules/interactions/lib/permissions";
import { interactionInput, type Interaction, type InteractionInput } from "@/modules/interactions/lib/types";
import { buildStudentDetail, SAMPLE_TODAY } from "@/common/sample-data/student-detail";
import { ROSTER } from "@/common/sample-data/roster";

/**
 * Interactions data access (UI-3). Sample data lives in process memory so the
 * flow works end to end in development (logs survive until the dev server
 * restarts). With the database this becomes logs.interactions +
 * logs.interaction_questions + logs.off_roadmap_questions (ARCHITECTURE §4.5).
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

export async function listInteractions(filter: { instructor?: string; niatId?: string; limit?: number } = {}) {
  const rows = store().interactions.filter(
    (it) => (!filter.instructor || it.assignedInstructor === filter.instructor) && (!filter.niatId || it.niatId === filter.niatId),
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
  const student = ROSTER.find((s) => s.niatId === input.niatId);
  if (!student) return { ok: false, error: "That student isn't in the roster." };
  if (!canLogFor(user, student)) return { ok: false, error: "You can only log interactions for students assigned to you." };

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
  for (const q of input.questions.filter((q) => q.offRoadmap)) {
    s.offRoadmap.push({
      title: q.title,
      niatId: input.niatId,
      by: user.name,
      at: interaction.createdAt,
      level: input.level,
      topic: input.topics[0] ?? "",
      subtopic: input.subtopics[0] ?? null,
    });
  }
  return { ok: true, interaction };
}

/** Every off-roadmap question logged, for the Curriculum review queue. */
export async function listOffRoadmapEntries(): Promise<OffRoadmapEntry[]> {
  return store().offRoadmap;
}
