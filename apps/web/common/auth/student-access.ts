/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import type { SessionUser } from "@/common/auth/roles";

/**
 * Who can see a student's full page (UI plan §6, decision 6 — recommended rule):
 * owners, admins and senior instructors see every student; instructors only the
 * students currently assigned to them.
 *
 * Sample data matches by instructor name; with the core roster this becomes a
 * lookup in core.student_assignments by staff id.
 */
export function canViewStudent(user: SessionUser, student: { instructor: string }): boolean {
  if (user.role !== "instructor") return true;
  return student.instructor === user.name;
}

/** Instructors' student lists are limited to their own students. */
export function instructorScope(user: SessionUser): string | undefined {
  return user.role === "instructor" ? user.name : undefined;
}
