/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { inScope, studentScope } from "@/common/auth/student-access";
import { getRoster } from "@/common/data/roster";
import { toCsv } from "@/common/lib/csv";
import { todayIst } from "@/common/lib/dates";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { isSupport, STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";
import { filterLog } from "@nxtone/interactions-ui/lib/log-filter";
import { parseRange } from "@/common/lib/range";

/**
 * CSV of interactions the signed-in person can see (instructors: their own students). With ?from=&to=
 * (and optional q=, by=, poc=) only those rows, exactly as the Interactions / Today's interactions pages list them.
 */
export async function GET(request: Request) {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const scope = studentScope(user);
  const visible = scope?.coach !== undefined
    ? await listInteractions({ niatIds: (await getRoster()).filter((s) => inScope(scope, s)).map((s) => s.niatId) })
    : await listInteractions({ instructor: scope?.instructor });
  const url = new URL(request.url);
  const dated = url.searchParams.has("from") || url.searchParams.has("to");
  const range = dated ? parseRange(Object.fromEntries(url.searchParams), todayIst(), 1) : null;
  const rows = range
    ? filterLog(visible, {
        from: range.from,
        to: range.to,
        q: (url.searchParams.get("q") ?? "").slice(0, 100),
        takenBy: url.searchParams.get("by") || null,
        poc: url.searchParams.get("poc") || null,
      })
    : visible;
  const csv = toCsv(
    ["Date", "NIAT ID", "Student", "Round", "Taken by", "Assigned instructor", "POC at the time", "Taken by support", "Level", "Topics", "Subtopics", "Steps reached", "Outcome", "Rating", "Questions asked", "Off-roadmap questions", "Tweaked questions", "Remarks", "Performed well", "Improvement areas", "Action items", "Recording link", "Transcript link"],
    rows.map((it) => [
      it.date,
      it.niatId,
      it.studentName,
      it.round,
      it.takenBy,
      it.assignedInstructor,
      it.pocAtTime,
      isSupport(it) ? "Yes" : "No",
      `Level ${it.level}`,
      it.topics.join("; "),
      it.subtopics.join("; "),
      Object.entries(it.stepsReached).map(([k, v]) => `${k}: ${v}`).join("; "),
      STATUS_LABEL[it.status],
      it.rating,
      it.questions.filter((q) => !q.offRoadmap).map((q) => q.title).join("; "),
      it.questions.filter((q) => q.offRoadmap).map((q) => q.title).join("; "),
      it.tweakedQuestions,
      it.remarks,
      it.performedWell,
      it.improvementAreas,
      it.actionItems,
      it.meetRecording,
      it.transcriptUrl,
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="interactions-${range ? (range.from === range.to ? range.from : `${range.from}_to_${range.to}`) : todayIst()}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
