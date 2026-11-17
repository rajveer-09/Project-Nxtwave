/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import type { SessionUser } from "@/common/auth/roles";

/**
 * Who sees which students:
 * - super admins, admins and senior instructors: every student
 * - instructors: the students currently assigned to them (My students)
 * - success coaches: the students they currently coach (My students)
 * Assignments come from core.student_assignments (the roster's instructor / coach).
 */
export type StudentScope = { instructor?: string; coach?: string };

export function studentScope(user: SessionUser): StudentScope | undefined {
  if (user.role === "instructor") return { instructor: user.name };
  if (user.role === "success_coach") return { coach: user.name };
  return undefined;
}

export function inScope(scope: StudentScope | undefined, student: { instructor: string; coach: string }): boolean {
  if (!scope) return true;
  if (scope.instructor !== undefined && student.instructor !== scope.instructor) return false;
  if (scope.coach !== undefined && student.coach !== scope.coach) return false;
  return true;
}

export function canViewStudent(user: SessionUser, student: { instructor: string; coach: string }): boolean {
  return inScope(studentScope(user), student);
}

/** Instructors' student lists are limited to their own students. */
export function instructorScope(user: SessionUser): string | undefined {
  return user.role === "instructor" ? user.name : undefined;
}
