/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import { authMode } from "@/common/auth/config";
import { getSessionUser, viewOnly } from "@/common/auth/session";
import { expire, TAGS } from "@/common/data/cache";
import { saveMarksFromHub, type SaveMarksResult } from "./db-service";

/**
 * Saves hall marks (Attendance page). NxtOne writes them to the attendance schema itself, with the
 * attendance service's rules, so marking works whether or not that service is running.
 */
export async function saveAttendanceAction(marks: { niat_id: string; date: string; status: "P" | "A" | null }[]): Promise<SaveMarksResult> {
  const blocked = await viewOnly(); // read-only while viewing as someone
  if (blocked) return blocked;
  const user = await getSessionUser();
  if (authMode() !== "database") return { ok: false, error: "Saving attendance needs the database." };
  const result = await saveMarksFromHub(user, marks);
  if (result.ok) expire(TAGS.roster, TAGS.home);
  return result;
}
