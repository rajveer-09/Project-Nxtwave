/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser } from "@/common/auth/session";
import { createInteraction } from "@nxtone/interactions-ui/data";

export type LogResult =
  | { ok: true; round: number; offRoadmap: number; studentName: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Saves one interaction. Validation and permission checks run here, whatever the form did. */
export async function logInteraction(payload: unknown): Promise<LogResult> {
  const user = await getSessionUser();
  const result = await createInteraction(payload, user);
  if (!result.ok) return result;
  return {
    ok: true,
    round: result.interaction.round,
    offRoadmap: result.interaction.questions.filter((q) => q.offRoadmap).length,
    studentName: result.interaction.studentName,
  };
}
