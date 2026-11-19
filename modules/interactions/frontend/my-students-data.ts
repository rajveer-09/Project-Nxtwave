/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import { inScope, studentScope } from "@/common/auth/student-access";
import { getRoster } from "@/common/data/roster";
import type { RosterStudent } from "@/common/sample-data/roster";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import type { FormStudent } from "@nxtone/interactions-ui/components/interaction-form";
import type { MyStudent } from "@nxtone/interactions-ui/components/my-students";
import { canLogInteractions } from "@nxtone/interactions-ui/lib/permissions";

/**
 * The students someone works with on the Interactions pages: an instructor's (or senior
 * instructor's) own students, a coach's coached students, everyone for admins.
 */
export async function scopedStudents(user: SessionUser) {
  const scope = studentScope(user) ?? (user.role === "senior_instructor" ? { instructor: user.name } : undefined);
  const roster = await getRoster();
  const students = roster.filter((s) => inScope(scope, s)).sort((a, b) => a.name.localeCompare(b.name));
  return { scope, roster, students };
}

export const isOverdue = (s: RosterStudent) => s.lastInteractionDays === null || s.lastInteractionDays >= RISK_THRESHOLDS.interactionGapDays;

/** Rows for the "My students" list (only for people who log their own students). */
export async function myStudentsList(user: SessionUser): Promise<MyStudent[] | null> {
  if (!canLogInteractions(user)) return null;
  const { students } = await scopedStudents(user);
  return students.map((s) => ({
    niatId: s.niatId,
    name: s.name,
    section: `${s.college} · ${s.section}`,
    level: s.level,
    topic: s.subtopic ? `${s.topic} › ${s.subtopic}` : s.topic,
    standing: s.standing,
    lastInteractionDays: s.lastInteractionDays,
    overdue: isOverdue(s),
  }));
}

const lastLabel = (days: number | null) => (days === null ? null : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

/** Everything the form shows about one of the logger's own students (attendance, last test, contests). */
export function fullFormStudent(s: RosterStudent, latestTest: number | null): FormStudent {
  return {
    niatId: s.niatId,
    name: s.name,
    group: `${s.college} · ${s.section} · ${s.hall}`,
    level: s.level,
    topic: s.topic,
    subtopic: s.subtopic,
    attendance30d: s.attendance30d,
    lastInteractionDays: s.lastInteractionDays,
    lastInteractionLabel: lastLabel(s.lastInteractionDays),
    contestAbsentStreak: s.risk.contestAbsentStreak,
    latestTest,
  };
}
