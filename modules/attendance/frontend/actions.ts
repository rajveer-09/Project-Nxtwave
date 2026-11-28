/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import { authMode } from "@/common/auth/config";
import { getSessionUser, viewOnly } from "@/common/auth/session";
import { expire, TAGS } from "@/common/data/cache";
import { canAccess } from "@/common/lib/nav";
import { todayIst } from "@/common/lib/dates";
import { saveMarksFromHub, unmarkedHalls, type SaveMarksResult, type UnmarkedFilter, type UnmarkedReport } from "./db-service";

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

/**
 * DSA attendance analytics › Halls not marked: for each day in the dates, the halls with students
 * left unmarked. Same people as the analytics page (owners, admins and success coaches).
 */
export async function unmarkedHallsAction(from: string, to: string, filter: UnmarkedFilter): Promise<{ ok: true; report: UnmarkedReport } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!canAccess(user.role, "/admin/attendance-analytics")) return { ok: false, error: "You can't see attendance analytics." };
  if (authMode() !== "database") return { ok: false, error: "This needs the database." };
  try {
    const f: UnmarkedFilter = {
      degree: String(filter.degree ?? "").slice(0, 20),
      hall: filter.hall === undefined || filter.hall === null ? undefined : String(filter.hall).slice(0, 40),
      section: String(filter.section ?? "").slice(0, 20),
    };
    return { ok: true, report: await unmarkedHalls(String(from), String(to), todayIst(), f) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't check the halls." };
  }
}
