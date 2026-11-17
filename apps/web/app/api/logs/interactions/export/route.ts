/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { instructorScope } from "@/common/auth/student-access";
import { toCsv } from "@/common/lib/csv";
import { todayIst } from "@/common/lib/dates";
import { listInteractions } from "@/modules/interactions/data";
import { STATUS_LABEL } from "@/modules/interactions/lib/types";

/** CSV of interactions the signed-in person can see (instructors: their own students). */
export async function GET() {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const rows = await listInteractions({ instructor: instructorScope(user) });
  const csv = toCsv(
    ["Date", "NIAT ID", "Student", "Round", "Taken by", "Assigned instructor", "Level", "Topics", "Subtopics", "Steps reached", "Outcome", "Rating", "Questions asked", "Off-roadmap questions", "Tweaked questions", "Remarks", "Performed well", "Improvement areas", "Action items", "Meet recording", "Transcript link"],
    rows.map((it) => [
      it.date,
      it.niatId,
      it.studentName,
      it.round,
      it.takenBy,
      it.assignedInstructor,
      `L${it.level}`,
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
      "content-disposition": `attachment; filename="interactions-${todayIst()}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
