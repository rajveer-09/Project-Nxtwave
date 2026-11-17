/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/common/auth/session";
import { addQuestion, decide, setArchived, undoDecision } from "./data";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const placement = {
  level: z.number().int().min(0).max(7),
  topic: z.string().min(1).max(80),
  subtopic: z.string().min(1).max(80).nullable(),
  step: z.string().max(10),
};

const questionSchema = z.object({
  ...placement,
  title: z.string().trim().min(1).max(200),
  source: z.string().trim().max(120),
  url: z.string().trim().max(500),
  notes: z.string().trim().max(1000),
  tweakOf: z.string().max(200).nullable(),
});

function done() {
  revalidatePath("/admin/curriculum");
  revalidatePath("/interactions");
}

export async function addQuestionAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the question title and where it goes." };
  const result = await addQuestion(user, parsed.data);
  if (!result.ok) return result;
  done();
  return { ok: true, message: `Added "${result.question.title}". Instructors can pick it now.` };
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
