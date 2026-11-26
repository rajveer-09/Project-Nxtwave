/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import type { SessionUser } from "@/common/auth/roles";
import { getRoster } from "@/common/data/roster";

/**
 * The students NxtOne assigns to this person (NIAT IDs), for "My students" in Contests: instructors
 * and senior instructors who teach. Sent to the contest service as roll numbers, so contests agree
 * with the rest of NxtOne rather than NxtRank's own instructor lists.
 */
export async function myStudentIds(user: SessionUser): Promise<string[]> {
  if (authMode() !== "database" || (user.role !== "instructor" && user.role !== "senior_instructor")) return [];
  return (await getRoster()).filter((s) => s.instructor === user.name).map((s) => s.niatId);
}

/** Every roster student's NIAT ID by college, for topic filters (the contest service's own college list is out of date). */
export async function idsByCollege(): Promise<Record<string, string[]>> {
  if (authMode() !== "database") return {};
  const out: Record<string, string[]> = {};
  for (const s of await getRoster()) (out[s.college] ??= []).push(s.niatId);
  return out;
}
