/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser, viewOnly } from "@/common/auth/session";
import { isAdminRole } from "@/common/auth/roles";
import { createInteraction, getInteractionLog, updateInteractionLog, type InteractionEdit } from "@nxtone/interactions-ui/data";
import { getStructure } from "@nxtone/interactions-ui/curriculum/structure";
import { reachedSteps } from "@nxtone/interactions-ui/curriculum/lib/structure";
import type { Interaction } from "@nxtone/interactions-ui/lib/types";
import { attachRoom } from "@nxtone/interactions-ui/room/data";

export type LogResult =
  | { ok: true; round: number; offRoadmap: number; studentName: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Saves one interaction. Validation and permission checks run here, whatever the form did. A code
 * room used during it (roomId) is attached to the saved interaction and ended.
 */
export async function logInteraction(payload: unknown, roomId?: string | null): Promise<LogResult> {
  const blocked = await viewOnly(); // read-only while viewing as someone
  if (blocked) return blocked;
  const user = await getSessionUser();
  const result = await createInteraction(payload, user);
  if (!result.ok) return result;
  await attachRoom(user, roomId ?? null, result.interaction.niatId, result.interaction.id).catch(() => false);
  return {
    ok: true,
    round: result.interaction.round,
    offRoadmap: result.interaction.questions.filter((q) => q.offRoadmap).length,
    studentName: result.interaction.studentName,
  };
}

// ---------------------------------------------------------------- one interaction (Interactions page)

export type InteractionLogView = {
  interaction: Interaction;
  questionsText: string;
  /** The viewer may edit it: an admin, who took it, or the student's instructor (the service checks again). */
  canEdit: boolean;
  /** Steps that can be recorded per topic / subtopic covered (none at Level 0). */
  stepOptions: { item: string; steps: { code: string; label: string }[] }[];
};

/** The full log of one interaction, for the row a viewer clicked. */
export async function openInteractionLog(id: string): Promise<{ ok: true; view: InteractionLogView } | { ok: false; error: string }> {
  const user = await getSessionUser();
  const detail = await getInteractionLog(id);
  if (!detail) return { ok: false, error: "This interaction couldn't be found. It may have been deleted." };
  const it = detail.interaction;
  const steps = reachedSteps(await getStructure(), it.level);
  const items = it.subtopics.length ? it.subtopics : it.topics;
  return {
    ok: true,
    view: {
      ...detail,
      canEdit: !user.viewedBy && (isAdminRole(user.role) || it.takenBy === user.name || it.assignedInstructor === user.name),
      stepOptions: steps.length ? items.map((item) => ({ item, steps })) : [],
    },
  };
}

/** Saves corrections to an interaction (date, outcome, rating, steps, questions, feedback, recording). */
export async function saveInteractionLog(id: string, edit: InteractionEdit): Promise<{ ok: true } | { ok: false; error: string }> {
  const blocked = await viewOnly();
  if (blocked) return blocked;
  const user = await getSessionUser();
  return updateInteractionLog(id, edit, user);
}
