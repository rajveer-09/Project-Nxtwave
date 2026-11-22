/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser, viewOnly } from "@/common/auth/session";
import { createInteraction } from "@nxtone/interactions-ui/data";
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
