/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/common/auth/session";
import { addQuestion, decide, setArchived, undoDecision, updateQuestion } from "./data";
import { MAX_LEVEL } from "./lib/structure";
import {
  addLevel,
  addStep,
  addSubtopic,
  addTopic,
  moveSubtopic,
  moveTopic,
  renameSubtopic,
  setLevelTitle,
  setSubtopicArchived,
  setTopicArchived,
  updateStep,
  updateTopic,
} from "./structure";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const placement = {
  level: z.number().int().min(0).max(MAX_LEVEL),
  topic: z.string().min(1).max(80),
  subtopic: z.string().min(1).max(80).nullable(),
  step: z.string().max(10),
};

const details = {
  title: z.string().trim().min(1).max(200),
  source: z.string().trim().max(120),
  url: z.string().trim().max(500),
  notes: z.string().trim().max(1000),
};

const questionSchema = z.object({ ...placement, ...details, tweakOf: z.string().max(200).nullable() });

function done() {
  revalidatePath("/admin/curriculum");
  revalidatePath("/interactions");
}

export async function addQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "title") ? "The question name is required." : "Pick where the question goes." };
  const result = await addQuestion(user, parsed.data);
  if (!result.ok) return result;
  done();
  return { ok: true, message: `Added "${result.question.title}". Instructors can pick it now.` };
}

export async function updateQuestionAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = z.object(details).safeParse(input);
  if (!parsed.success) return { ok: false, error: "The question name is required." };
  const result = await updateQuestion(user, String(id), parsed.data);
  if (result.ok) done();
  return result.ok ? { ok: true, message: `Saved "${parsed.data.title}".` } : result;
}

export async function archiveQuestionAction(id: string, archived: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await setArchived(user, String(id), !!archived);
  if (result.ok) done();
  return result.ok ? { ok: true, message: archived ? "Archived. Past interactions keep it." : "Restored." } : result;
}

export async function decideAction(key: string, action: unknown, where: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const act = z.enum(["added", "kept", "dismissed"]).safeParse(action);
  if (!act.success) return { ok: false, error: "Unknown decision." };
  const place = act.data === "added" ? z.object(placement).safeParse(where) : null;
  if (place && !place.success) return { ok: false, error: "Pick where it goes in the roadmap." };
  const result = await decide(user, String(key), act.data, place?.success ? place.data : undefined);
  if (result.ok) done();
  const msg = { added: "Added to the roadmap. Instructors can pick it now.", kept: "Kept as an extra question.", dismissed: "Dismissed." }[act.data];
  return result.ok ? { ok: true, message: msg } : result;
}

export async function undoDecisionAction(key: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await undoDecision(user, String(key));
  if (result.ok) done();
  return result.ok ? { ok: true, message: "Undone." } : result;
}

// ---------------------------------------------------------------- roadmap structure

/** One action for every structure edit, so the editor stays simple. */
const structureEdit = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("addLevel"), title: z.string().max(80) }),
  z.object({ kind: z.literal("levelTitle"), level: z.number().int().min(0).max(MAX_LEVEL), title: z.string().max(80) }),
  z.object({
    kind: z.literal("addTopic"),
    level: z.number().int().min(0).max(MAX_LEVEL),
    name: z.string().max(120),
    maxStep: z.string().max(10).nullable(),
    required: z.boolean(),
  }),
  z.object({
    kind: z.literal("updateTopic"),
    id: z.string().max(40),
    name: z.string().max(120).optional(),
    maxStep: z.string().max(10).nullable().optional(),
    required: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("archiveTopic"), id: z.string().max(40), archived: z.boolean() }),
  z.object({ kind: z.literal("moveTopic"), id: z.string().max(40), direction: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ kind: z.literal("addSubtopic"), topicId: z.string().max(40), name: z.string().max(120) }),
  z.object({ kind: z.literal("renameSubtopic"), id: z.string().max(40), name: z.string().max(120) }),
  z.object({ kind: z.literal("archiveSubtopic"), id: z.string().max(40), archived: z.boolean() }),
  z.object({ kind: z.literal("moveSubtopic"), id: z.string().max(40), direction: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ kind: z.literal("addStep"), code: z.string().max(10), label: z.string().max(120) }),
  z.object({ kind: z.literal("updateStep"), code: z.string().max(10), label: z.string().max(120).optional(), archived: z.boolean().optional() }),
]);
export type StructureEdit = z.infer<typeof structureEdit>;

export async function structureAction(input: StructureEdit): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = structureEdit.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change isn't valid." };
  const e = parsed.data;
  const result = await (() => {
    switch (e.kind) {
      case "addLevel":
        return addLevel(user, e.title);
      case "levelTitle":
        return setLevelTitle(user, e.level, e.title);
      case "addTopic":
        return addTopic(user, e.level, e.name, e.maxStep, e.required);
      case "updateTopic":
        return updateTopic(user, e.id, { name: e.name, maxStep: e.maxStep, required: e.required });
      case "archiveTopic":
        return setTopicArchived(user, e.id, e.archived);
      case "moveTopic":
        return moveTopic(user, e.id, e.direction);
      case "addSubtopic":
        return addSubtopic(user, e.topicId, e.name);
      case "renameSubtopic":
        return renameSubtopic(user, e.id, e.name);
      case "archiveSubtopic":
        return setSubtopicArchived(user, e.id, e.archived);
      case "moveSubtopic":
        return moveSubtopic(user, e.id, e.direction);
      case "addStep":
        return addStep(user, e.code, e.label);
      case "updateStep":
        return updateStep(user, e.code, { label: e.label, archived: e.archived });
    }
  })();
  if (result.ok) done();
  return result;
}
