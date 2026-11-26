import { searchMatcher } from "@/common/lib/search";
import type { Interaction } from "@nxtone/interactions-ui/lib/types";

export type LogFilter = { from: string; to: string; q: string; takenBy?: string | null; poc?: string | null };

/**
 * Interactions dated from–to (inclusive, YYYY-MM-DD) that match the search (student, NIAT ID, POC,
 * who took it, topics or remarks), optionally only those one person took (takenBy) and/or only one
 * POC's students (poc = the student's instructor when it was logged). Shared by the Interactions
 * page, Today's interactions and the CSV export, so all three always hold the same rows.
 */
export function filterLog(all: Interaction[], { from, to, q, takenBy, poc }: LogFilter): Interaction[] {
  const match = searchMatcher(q);
  return all.filter(
    (it) =>
      it.date >= from &&
      it.date <= to &&
      (!takenBy || it.takenBy === takenBy) &&
      (!poc || it.pocAtTime === poc) &&
      match(it.studentName, it.niatId, it.pocAtTime, it.takenBy, it.topics.join(" "), it.subtopics.join(" "), it.remarks),
  );
}
