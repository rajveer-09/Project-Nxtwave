/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { revalidateTag, updateTag } from "next/cache";

/**
 * Cache tags for data shared by everyone (read through "use cache: remote", so every server
 * instance shares one copy). After a write, expire the tags it touched: inside a Server Action
 * the next read waits for fresh data (the person sees their own change at once); elsewhere the
 * stale copy is served while a fresh one is built.
 */
export const TAGS = {
  roster: "roster",
  interactions: "interactions",
  student: (niatId: string) => `student:${niatId.toUpperCase()}`,
  home: "home",
  staff: "staff",
  tests: "tests",
  curriculum: "curriculum",
} as const;

export function expire(...tags: string[]) {
  for (const tag of tags) {
    try {
      updateTag(tag);
    } catch {
      revalidateTag(tag, "max");
    }
  }
}
