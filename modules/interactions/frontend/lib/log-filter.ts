import { searchMatcher } from "@/common/lib/search";
import type { Interaction } from "@nxtone/interactions-ui/lib/types";

/**
 * The "Today's interactions" list: interactions dated from–to (inclusive, YYYY-MM-DD) that match the
 * search (student, NIAT ID, POC, who took it, topics or remarks). Shared by the page and its CSV
 * export, so both always hold the same rows.
 */
export function filterLog(all: Interaction[], { from, to, q }: { from: string; to: string; q: string }): Interaction[] {
  const match = searchMatcher(q);
  return all.filter(
    (it) =>
      it.date >= from &&
      it.date <= to &&
      match(it.studentName, it.niatId, it.pocAtTime, it.takenBy, it.topics.join(" "), it.subtopics.join(" "), it.remarks),
  );
}
