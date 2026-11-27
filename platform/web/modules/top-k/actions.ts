/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, viewOnly } from "@/common/auth/session";
import { setTopK, type MarkResult } from "@/modules/top-k/data";

/** Marks or unmarks students as Top K (permission checked in setTopK), then refreshes the pages that show it. */
export async function markTopKAction(niatIds: string[], on: boolean): Promise<MarkResult> {
  const blocked = await viewOnly();
  if (blocked) return blocked;
  const result = await setTopK(await getSessionUser(), niatIds, on);
  if (result.ok) {
    revalidatePath("/top-k");
    revalidatePath("/contests");
  }
  return result;
}
