/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import { passwordPolicyError, hashPassword } from "@/common/auth/core/password";
import { platformRole, revokeAllSessions } from "@/common/auth/core/sessions";
import { assignableRoles, visibleRoles, type Role, type SessionUser } from "@/common/auth/roles";
import { withChange } from "@/common/db/change";
import { getDb } from "@/common/db/pool";
import { ROSTER } from "@/common/sample-data/roster";
import { STAFF } from "@/common/sample-data/staff";

/**
 * Staff & roles. Who you see and who you may edit follows the rank rules in common/auth/roles.ts:
 * super admins see and manage everyone; admins see and manage everyone except super admins
 * (they can make and edit admins); senior instructors see instructors, coaches and other
 * seniors, read-only. Every change goes through withChange(), so core.change_log records who did it.
 */

export type StaffListRow = {
  id: string;
  name: string;
  email: string;
  instructorCode: string | null;
  active: boolean;
  signIn: "password" | "google";
  /** Platform role (what they can open in NxtOne); null = no access. */
  role: Role | null;
  roles: { module: string; role: string }[];
  studentsAssigned: number;
  /** Whether the person looking may change this row. */
  editable: boolean;
};

const fromDb = () => authMode() === "database";

function canEdit(viewer: SessionUser, staffId: string, role: Role | null) {
  if (staffId === viewer.id) return false;
  const allowed = assignableRoles(viewer.role);
  return allowed.length > 0 && (role === null || allowed.includes(role));
}

/** Sample rows from the shared sample staff directory (same people as Messages and the roster). */
function sampleRows(viewer: SessionUser): StaffListRow[] {
  const MODULE_ROLE: Record<Role, { module: string; role: string }[]> = {
    owner: [{ module: "platform", role: "owner" }],
    admin: [{ module: "platform", role: "admin" }, { module: "attendance", role: "admin" }],
    senior_instructor: [{ module: "platform", role: "senior_instructor" }, { module: "logs", role: "senior_instructor" }],
    instructor: [{ module: "platform", role: "instructor" }, { module: "logs", role: "instructor" }, { module: "contest", role: "instructor" }],
    success_coach: [{ module: "platform", role: "success_coach" }],
  };
  const visible = new Set(visibleRoles(viewer.role));
  return STAFF.filter((s) => visible.has(s.role)).map((s, i) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    instructorCode: s.role.includes("instructor") ? `INS${String(i + 1).padStart(3, "0")}` : null,
    active: s.active,
    signIn: s.role === "owner" || s.role === "admin" ? "google" : "password",
    role: s.role,
    roles: MODULE_ROLE[s.role],
    studentsAssigned: ROSTER.filter((r) => r.instructor === s.name).length,
    editable: false,
  }));
}

export async function listStaff(viewer: SessionUser): Promise<{ rows: StaffListRow[]; sample: boolean }> {
  if (!fromDb()) return { rows: sampleRows(viewer), sample: true };
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
    `SELECT s.id::text, s.name, lower(s.email::text) AS email, s.instructor_code, s.active AND s.left_on IS NULL AS active,
            s.password_hash IS NOT NULL AS has_password,
            COALESCE((SELECT json_agg(json_build_object('module', r.module, 'role', r.role) ORDER BY r.module)
                      FROM core.staff_roles r WHERE r.staff_id = s.id), '[]') AS roles,
            (SELECT count(*)::int FROM core.student_assignments a
              WHERE a.staff_id = s.id AND a.to_date IS NULL) AS students
     FROM core.staff s
     ORDER BY s.active DESC, s.name`,
  );
  const visible = new Set<Role | null>(visibleRoles(viewer.role));
  // People with no platform access are listed for admins (so they can be given a role), not for seniors.
  if (assignableRoles(viewer.role).length) visible.add(null);
  return {
    sample: false,
    rows: rows
      .map((r) => {
        const role = platformRole(r.roles);
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          instructorCode: r.instructor_code,
          active: r.active,
          signIn: r.has_password ? ("password" as const) : ("google" as const),
          role,
          roles: r.roles,
          studentsAssigned: r.students,
          editable: canEdit(viewer, r.id, role),
        };
      })
      .filter((r) => visible.has(r.role)),
  };
}

type Result = { ok: true; message: string } | { ok: false; error: string };

async function currentRole(staffId: string): Promise<{ name: string; role: Role | null } | null> {
  const { rows } = await getDb().query<{ name: string; roles: { module: string; role: string }[] }>(
    `SELECT s.name, COALESCE((SELECT json_agg(json_build_object('module', r.module, 'role', r.role)) FROM core.staff_roles r WHERE r.staff_id = s.id), '[]') AS roles
     FROM core.staff s WHERE s.id = $1`,
    [staffId],
  );
  return rows[0] ? { name: rows[0].name, role: platformRole(rows[0].roles) } : null;
}

async function checkTarget(viewer: SessionUser, staffId: string) {
  if (!fromDb()) return { error: "Editing staff needs the database." } as const;
  if (!/^\d+$/.test(staffId)) return { error: "Unknown person." } as const;
  if (staffId === viewer.id) return { error: "You can't change your own access. Ask another admin." } as const;
  const target = await currentRole(staffId);
  if (!target) return { error: "Unknown person." } as const;
  if (!canEdit(viewer, staffId, target.role)) return { error: "You don't have permission to change this person." } as const;
  return { target } as const;
}

export async function setStaffRole(viewer: SessionUser, staffId: string, role: Role): Promise<Result> {
  const check = await checkTarget(viewer, staffId);
  if ("error" in check) return { ok: false, error: check.error! };
  if (!assignableRoles(viewer.role).includes(role)) return { ok: false, error: "You can't give that role." };
  if (check.target.role === role) return { ok: true, message: "No change." };
  await withChange(viewer, "ui", null, (db) =>
    db.query(
      `INSERT INTO core.staff_roles (staff_id, module, role) VALUES ($1, 'platform', $2)
       ON CONFLICT (staff_id, module) DO UPDATE SET role = EXCLUDED.role`,
      [staffId, role],
    ),
  );
  return { ok: true, message: `${check.target.name} is now ${role.replace("_", " ")}.` };
}

export async function setStaffActive(viewer: SessionUser, staffId: string, active: boolean): Promise<Result> {
  const check = await checkTarget(viewer, staffId);
  if ("error" in check) return { ok: false, error: check.error! };
  await withChange(viewer, "ui", null, async (db) => {
    await db.query("UPDATE core.staff SET active = $2 WHERE id = $1", [staffId, active]);
    // Signing someone out everywhere when they're deactivated.
    if (!active) await revokeAllSessions(db, staffId);
  });
  return { ok: true, message: `${check.target.name} ${active ? "can sign in again" : "can no longer sign in"}.` };
}

export async function addStaff(viewer: SessionUser, input: { name: string; email: string; role: Role; password: string }): Promise<Result> {
  if (!fromDb()) return { ok: false, error: "Adding staff needs the database." };
  if (!assignableRoles(viewer.role).includes(input.role)) return { ok: false, error: "You can't give that role." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: "Enter the person's full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password) {
    const problem = passwordPolicyError(input.password);
    if (problem) return { ok: false, error: problem };
  }
  const hash = input.password ? await hashPassword(input.password) : null;
  try {
    await withChange(viewer, "ui", null, async (db) => {
      const { rows } = await db.query<{ id: string }>("INSERT INTO core.staff (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id::text", [email, name, hash]);
      await db.query("INSERT INTO core.staff_roles (staff_id, module, role) VALUES ($1, 'platform', $2)", [rows[0].id, input.role]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return { ok: false, error: `${email} already has an account.` };
    throw err;
  }
  return { ok: true, message: `${name} added${hash ? "" : " (Google sign-in only)"}.` };
}
