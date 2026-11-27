/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use server";

import { getSessionUser } from "@/common/auth/session";
import { canViewStudent } from "@/common/auth/student-access";
import { canLogForOthers } from "@nxtone/interactions-ui/lib/permissions";
import { getRosterStudent } from "@/common/data/roster";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { coveredLabel, isSupport, STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";
import { roomsByInteraction } from "@nxtone/interactions-ui/room/data";

export type HistoryEntry = {
  id: string;
  date: string;
  round: number;
  /** Position in the student's history, oldest = 1 (the stored round is 1 for most migrated interactions). */
  number: number;
  takenBy: string;
  /** The student's POC when it was logged; differs from takenBy when a support POC took it. */
  poc: string;
  support: boolean;
  level: number;
  covered: string;
  topics: string[];
  subtopics: string[];
  /** Steps reached per subtopic, e.g. "LCM & GCD: 3.1" (", "-joined). */
  stepsDetail: string;
  /** Steps reached, e.g. "3.2" (several joined with ", "). */
  steps: string;
  status: string;
  statusKey: string;
  rating: number;
  questions: { title: string; step?: string; offRoadmap: boolean }[];
  tweakedQuestions: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  actionItems: string;
  /** https link to the recording, "" when none. */
  meetRecording: string;
  /** Code room saved with this interaction, if any. */
  codeRoom?: string;
  /** Only when one interaction is opened (Inspect): the transcript link and pasted text, if any. */
  transcriptLink?: string;
  transcriptText?: string;
};

/** The stored transcript ("Transcript: <link>" and / or the pasted text) as its link and its text. */
function splitTranscript(stored: string): { transcriptLink?: string; transcriptText?: string } {
  const raw = stored.replace(/\r\n/g, "\n").trim();
  if (!raw) return {};
  const m = /^Transcript:\s*(https?:\/\/\S+)\s*/i.exec(raw);
  const text = (m ? raw.slice(m[0].length) : raw).trim();
  return { ...(m ? { transcriptLink: m[1] } : {}), ...(text ? { transcriptText: text } : {}) };
}

export type HistoryStudent = { niatId: string; name: string; college: string; section: string; hall: string; instructor: string; level: number };

type Student = NonNullable<Awaited<ReturnType<typeof getRosterStudent>>>;

/** A student's interactions as History entries, newest first (the oldest, last, is number 1). */
async function historyEntries(student: Student): Promise<HistoryEntry[]> {
  const rows = await listInteractions({ niatId: student.niatId });
  const rooms = await roomsByInteraction(rows.map((it) => it.id));
  return rows.map((it, i) => ({
    id: it.id,
    date: it.date,
    round: it.round,
    number: rows.length - i,
    takenBy: it.takenBy,
    poc: it.pocAtTime,
    support: isSupport(it),
    level: it.level,
    covered: coveredLabel(it.topics, it.subtopics),
    topics: it.topics,
    subtopics: it.subtopics,
    stepsDetail: Object.entries(it.stepsReached).map(([k, v]) => `${k}: ${v}`).join(", "),
    steps: [...new Set(Object.values(it.stepsReached).filter(Boolean))].join(", "),
    status: STATUS_LABEL[it.status] ?? it.status,
    statusKey: it.status,
    rating: it.rating,
    questions: it.questions.map((q) => ({ title: q.title, step: q.step, offRoadmap: q.offRoadmap })),
    tweakedQuestions: it.tweakedQuestions,
    remarks: it.remarks,
    performedWell: it.performedWell,
    improvementAreas: it.improvementAreas,
    actionItems: it.actionItems,
    meetRecording: /^https:\/\//i.test(it.meetRecording) ? it.meetRecording : "",
    ...(rooms[it.id] ? { codeRoom: rooms[it.id] } : {}),
  }));
}

const studentInfo = (s: Student): HistoryStudent => ({ niatId: s.niatId, name: s.name, college: s.college, section: s.section, hall: s.hall, instructor: s.instructor, level: s.level });

/** A student and their interactions (newest first) for the History pop-up on Students. */
export async function studentHistoryAction(
  niatId: string,
): Promise<{ ok: true; name: string; student: HistoryStudent; entries: HistoryEntry[] } | { ok: false; error: string }> {
  const user = await getSessionUser();
  const student = await getRosterStudent(String(niatId).toUpperCase());
  // Their own students, or (to log for them) any student for those who log for others.
  if (!student || !(canViewStudent(user, student) || canLogForOthers(user))) return { ok: false, error: "That student isn't in your list." };
  return { ok: true, name: student.name, student: studentInfo(student), entries: await historyEntries(student) };
}

/**
 * One interaction's full record, for Inspect. Allowed for anyone who may see the student, and for
 * the person who took it (an instructor who covered for another POC's student sees their own entry).
 */
export async function interactionRecordAction(niatId: string, interactionId: string): Promise<{ ok: true; entry: HistoryEntry } | { ok: false; error: string }> {
  const user = await getSessionUser();
  const student = await getRosterStudent(String(niatId).toUpperCase());
  if (!student) return { ok: false, error: "That student isn't on the roster." };
  const entry = (await historyEntries(student)).find((e) => e.id === String(interactionId));
  if (!entry) return { ok: false, error: "This interaction isn't there any more. It may have been deleted." };
  if (!canViewStudent(user, student) && !canLogForOthers(user) && entry.takenBy !== user.name) return { ok: false, error: "You can only open interactions of your students or ones you took yourself." };
  // The transcript only here, for the one interaction opened (lists leave the long text out).
  const full = (await listInteractions({ niatId: student.niatId })).find((it) => it.id === entry.id);
  return { ok: true, entry: { ...entry, ...splitTranscript(full?.transcriptText ?? "") } };
}
