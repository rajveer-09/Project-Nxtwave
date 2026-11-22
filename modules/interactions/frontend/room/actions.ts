/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser, viewOnly } from "@/common/auth/session";
import { startRoom } from "@nxtone/interactions-ui/room/data";

/** Starts a code room for a student (or reopens today's open one) and returns its id. */
export async function startCodeRoom(niatId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const blocked = await viewOnly(); // read-only while viewing as someone
  if (blocked) return blocked;
  const user = await getSessionUser();
  const result = await startRoom(user, String(niatId ?? ""));
  return result.ok ? result : { ok: false, error: result.error };
}
