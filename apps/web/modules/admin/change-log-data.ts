/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import { isAdminRole, ROLE_LABEL, type Role, type SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";

/**
 * The change log (core.change_log), for admins and super admins. Each entry says what changed,
 * who made the change and from where. Admins never see super admins: a super admin's edits show
 * as "Super admin", and changes to super admins' own accounts are left out.
 */

export const SOURCES = ["ui", "excel", "interactions-api", "attendance-api", "contest-api", "database", "migration"] as const;
export const ENTITIES = ["student_assignment", "student", "attendance_student", "staff_role", "staff"] as const;
export type Source = (typeof SOURCES)[number];
export type Entity = (typeof ENTITIES)[number];

export const SOURCE_LABEL: Record<string, string> = {
  ui: "NxtOne",
  excel: "Excel import",
  "interactions-api": "Interactions service",
  "attendance-api": "Attendance service",
  "contest-api": "Contests service",
  database: "Database edit",
  migration: "Data migration",
};
export const ENTITY_LABEL: Record<string, string> = {
  student_assignment: "Assignment",
  student: "Student",
  attendance_student: "Attendance roster",
  staff_role: "Role",
  staff: "Staff",
};

export type ChangeFilter = { q?: string; source?: string; entity?: string; from?: string; to?: string; page?: number };

export type ChangeEntry = {
  id: string;
  at: string;
  entity: string;
  what: string;
  subject: { kind: "student"; niatId: string; name: string } | { kind: "staff"; name: string } | null;
  before: string | null;
  after: string | null;
  by: string;
  byRole: string | null;
  source: string;
  sourceDetail: string | null;
};

const PAGE = 50;
const FIELD_LABEL: Record<string, string> = {
  instructor: "Instructor",
  coach: "Success coach",
  poc: "POC",
  hall: "Hall",
  section: "Section",
  college: "College",
  status: "Status",
  name: "Name",
  email: "Email",
  active: "Sign-in",
  left_on: "Left on",
  password: "Password",
  joined_on: "Joined on",
  dropped_on: "Dropped on",
  platform: "NxtOne role",
  attendance: "Attendance role",
  logs: "Interactions role",
  contest: "Contests role",
};
const roleLabel = (v: string | null) => (v && v in ROLE_LABEL ? ROLE_LABEL[v as Role] : v);

type Row = {
  id: string;
  at: string;
  txid: string;
  source: string;
  source_detail: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  entity: string;
  action: string;
  niat_id: string | null;
  student_name: string | null;
  staff_name: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
};

export async function listChanges(viewer: SessionUser, filter: ChangeFilter): Promise<{ entries: ChangeEntry[]; page: number; more: boolean }> {
  if (authMode() !== "database" || !isAdminRole(viewer.role)) return { entries: [], page: 1, more: false };
  const page = Math.max(1, filter.page ?? 1);
  const q = filter.q?.trim() || null;
  const { rows } = await getDb().query<Row>(
    `SELECT c.id::text, c.at, c.txid::text, c.source, c.source_detail, c.actor_name, c.actor_email, c.actor_role,
            c.entity, c.action, c.niat_id, cs.full_name AS student_name, st.name AS staff_name, c.field, c.old_value, c.new_value
     FROM core.change_log c
     LEFT JOIN core.students cs ON cs.niat_id = c.niat_id
     LEFT JOIN core.staff st ON st.id = c.staff_id
     WHERE ($1::text IS NULL OR c.source = $1)
       AND ($2::text IS NULL OR c.entity = $2)
       AND ($3::date IS NULL OR c.at >= $3::date)
       AND ($4::date IS NULL OR c.at < $4::date + 1)
       AND ($5::text IS NULL OR c.niat_id ILIKE '%' || $5 || '%' OR cs.full_name ILIKE '%' || $5 || '%' OR st.name ILIKE '%' || $5 || '%'
            OR c.actor_name ILIKE '%' || $5 || '%' OR c.old_value ILIKE '%' || $5 || '%' OR c.new_value ILIKE '%' || $5 || '%')
       -- Admins: nothing about super admins' own accounts or roles.
       AND ($6 OR NOT (c.entity IN ('staff', 'staff_role') AND (
             c.old_value = 'owner' OR c.new_value = 'owner'
             OR EXISTS (SELECT 1 FROM core.staff_roles r WHERE r.staff_id = c.staff_id AND r.module = 'platform' AND r.role = 'owner'))))
     ORDER BY c.at DESC, c.id DESC
     LIMIT $7 OFFSET $8`,
    [
      filter.source || null,
      filter.entity || null,
      filter.from || null,
      filter.to || null,
      q,
      viewer.role === "owner",
      PAGE + 1,
      (page - 1) * PAGE,
    ],
  );
  const more = rows.length > PAGE;
  return { entries: merge(rows.slice(0, PAGE), viewer), page, more };
}

/** One change can write two rows (an assignment ends and a new one starts); show them as one. */
function merge(rows: Row[], viewer: SessionUser): ChangeEntry[] {
  const out: ChangeEntry[] = [];
  const used = new Set<string>();
  for (const r of rows) {
    if (used.has(r.id)) continue;
    let before = r.old_value;
    let after = r.new_value;
    if (r.entity === "student_assignment" && (r.action === "ended" || r.action === "assigned")) {
      const pair = rows.find(
        (x) => !used.has(x.id) && x.id !== r.id && x.txid === r.txid && x.niat_id === r.niat_id && x.field === r.field && x.entity === r.entity && x.action === (r.action === "ended" ? "assigned" : "ended"),
      );
      if (pair) {
        used.add(pair.id);
        before = r.action === "ended" ? r.old_value : pair.old_value;
        after = r.action === "assigned" ? r.new_value : pair.new_value;
      }
    }
    used.add(r.id);
    const field = r.field ? (FIELD_LABEL[r.field] ?? r.field) : null;
    const isRole = r.entity === "staff_role";
    const hideActor = viewer.role !== "owner" && r.actor_role === "owner";
    out.push({
      id: r.id,
      at: new Date(r.at).toISOString(),
      entity: r.entity,
      what:
        r.entity === "staff" && r.action === "added"
          ? "Staff added"
          : r.entity === "student" && r.action === "added"
            ? "Added to roster"
            : r.action === "removed" && !field
              ? "Removed from roster"
              : `${field ?? ENTITY_LABEL[r.entity] ?? r.entity}${r.action === "ended" && after === null ? " removed" : ""}`,
      subject: r.niat_id
        ? { kind: "student", niatId: r.niat_id, name: r.student_name ?? r.niat_id }
        : r.staff_name
          ? { kind: "staff", name: r.staff_name }
          : null,
      before: isRole ? roleLabel(before) : r.field === "password" ? null : before,
      after: isRole ? roleLabel(after) : r.field === "password" ? "changed" : after,
      by: hideActor ? "Super admin" : (r.actor_name ?? (r.source === "database" ? "Direct database edit" : "System")),
      byRole: hideActor ? null : r.actor_role ? (roleLabel(r.actor_role) ?? r.actor_role) : null,
      source: SOURCE_LABEL[r.source] ?? r.source,
      sourceDetail: hideActor ? null : r.source_detail,
    });
  }
  return out;
}

/** The latest changes for one student (Student page, admins only). */
export async function studentChanges(viewer: SessionUser, niatId: string) {
  return (await listChanges(viewer, { q: niatId.toUpperCase() })).entries.filter((e) => e.subject?.kind === "student" && e.subject.niatId === niatId.toUpperCase());
}
