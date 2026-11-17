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
