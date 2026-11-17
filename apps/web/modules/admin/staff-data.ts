/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import { getDb } from "@/common/db/pool";
import { ROSTER } from "@/common/sample-data/roster";
import { STAFF } from "@/common/sample-data/staff";

export type StaffListRow = {
  id: string;
  name: string;
  email: string;
  instructorCode: string | null;
  active: boolean;
  signIn: "password" | "google";
  roles: { module: string; role: string }[];
  studentsAssigned: number;
};

/** Sample rows from the shared sample staff directory (same people as Messages and the roster). */
function sampleRows(): StaffListRow[] {
  const MODULE_ROLE: Record<string, { module: string; role: string }[]> = {
    owner: [{ module: "platform", role: "owner" }],
    admin: [{ module: "platform", role: "admin" }, { module: "attendance", role: "admin" }],
    senior_instructor: [{ module: "platform", role: "senior_instructor" }, { module: "logs", role: "senior_instructor" }],
    instructor: [{ module: "platform", role: "instructor" }, { module: "logs", role: "instructor" }, { module: "contest", role: "instructor" }],
  };
  return STAFF.map((s, i) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    instructorCode: s.role.includes("instructor") ? `INS${String(i + 1).padStart(3, "0")}` : null,
    active: s.active,
    signIn: s.role === "owner" || s.role === "admin" ? "google" : "password",
    roles: MODULE_ROLE[s.role],
    studentsAssigned: ROSTER.filter((r) => r.instructor === s.name).length,
  }));
}

export async function listStaff(): Promise<{ rows: StaffListRow[]; sample: boolean }> {
  if (authMode() !== "database") return { rows: sampleRows(), sample: true };
  const { rows } = await getDb().query<{
    id: string;
    name: string;
    email: string;
    instructor_code: string | null;
    active: boolean;
    has_password: boolean;
    roles: { module: string; role: string }[];
    students: number;
  }>(
    `SELECT s.id, s.name, lower(s.email::text) AS email, s.instructor_code, s.active AND s.left_on IS NULL AS active,
            s.password_hash IS NOT NULL AS has_password,
            COALESCE((SELECT json_agg(json_build_object('module', r.module, 'role', r.role) ORDER BY r.module)
                      FROM core.staff_roles r WHERE r.staff_id = s.id), '[]') AS roles,
            (SELECT count(*)::int FROM core.student_assignments a
              WHERE a.staff_id = s.id AND a.kind = 'instructor' AND a.to_date IS NULL) AS students
     FROM core.staff s
     ORDER BY s.active DESC, s.name`,
  );
  return {
    sample: false,
    rows: rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      email: r.email,
      instructorCode: r.instructor_code,
      active: r.active,
      signIn: r.has_password ? "password" : "google",
      roles: r.roles,
      studentsAssigned: r.students,
    })),
  };
}
