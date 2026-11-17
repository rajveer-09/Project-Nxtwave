/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import type { SessionUser } from "@/common/auth/roles";

/**
 * Who can log an interaction, carried over from the Interactions app:
 * instructors (including senior instructors) for students assigned to them.
 * Owners and admins can read every log but don't log themselves.
 *
 * Sample data matches by instructor name; with core.student_assignments this
 * becomes a staff-id check.
 */
export function canLogInteractions(user: SessionUser): boolean {
  return user.role === "instructor" || user.role === "senior_instructor";
}

export function canLogFor(user: SessionUser, student: { instructor: string }): boolean {
  return canLogInteractions(user) && student.instructor === user.name;
}

/**
 * Logging for someone else's student (sidebar "Log interaction"): instructors, senior instructors
 * and admins type a NIAT ID and log what they took themselves. "Taken by" is always the person
 * logging, and they see nothing more of that student than the form needs.
 */
export function canLogForOthers(user: Pick<SessionUser, "role">): boolean {
  return user.role === "instructor" || user.role === "senior_instructor" || user.role === "admin" || user.role === "owner";
}

/** Where "Log interaction" goes for a student: the Interactions page for one's own, else the any-student page. */
export function logHrefFor(user: SessionUser, student: { niatId: string; instructor: string }): string | null {
  if (canLogFor(user, student)) return `/interactions?student=${student.niatId}`;
  if (canLogForOthers(user)) return `/log-interaction?niat=${student.niatId}`;
  return null;
}
