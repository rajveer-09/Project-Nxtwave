/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser } from "@/common/auth/session";
import { canViewStudent } from "@/common/auth/student-access";
import { getRosterStudent } from "@/common/data/roster";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";

export type HistoryEntry = {
  id: string;
  date: string;
  round: number;
  takenBy: string;
  level: number;
  covered: string;
  status: string;
  rating: number;
  questions: { title: string; step?: string; offRoadmap: boolean }[];
  remarks: string;
  actionItems: string;
};

/** A student's interaction history for the History pop-up on the Students list (newest first). */
export async function studentHistoryAction(niatId: string): Promise<{ ok: true; name: string; entries: HistoryEntry[] } | { ok: false; error: string }> {
  const user = await getSessionUser();
  const student = await getRosterStudent(String(niatId).toUpperCase());
  if (!student || !canViewStudent(user, student)) return { ok: false, error: "That student isn't in your list." };
  const rows = await listInteractions({ niatId: student.niatId });
  return {
    ok: true,
    name: student.name,
    entries: rows.map((it) => ({
      id: it.id,
      date: it.date,
      round: it.round,
      takenBy: it.takenBy,
      level: it.level,
      covered: [it.topics.join(", "), it.subtopics.length ? it.subtopics.join(", ") : ""].filter(Boolean).join(" › "),
      status: STATUS_LABEL[it.status] ?? it.status,
      rating: it.rating,
      questions: it.questions.map((q) => ({ title: q.title, step: q.step, offRoadmap: q.offRoadmap })),
      remarks: it.remarks,
      actionItems: it.actionItems,
    })),
  };
}
