/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { expire, TAGS } from "@/common/data/cache";
import { readSheet } from "read-excel-file/node";
import { authMode } from "@/common/auth/config";
import { platformRole } from "@/common/auth/core/sessions";
import type { Db } from "@/common/auth/core/db";
import { hasPanel, type SessionUser } from "@/common/auth/roles";
import { getRoster } from "@/common/data/roster";
import { toCsv } from "@/common/lib/csv";
import { withChange, type ChangeSource } from "@/common/db/change";
import { getDb } from "@/common/db/pool";

/**
 * Who teaches and coaches whom. Every change goes through core.assign_staff() inside
 * withChange(), so history is kept and core.change_log records the person and the source
 * ("ui" for a single change, "excel" with the file name for an import). An instructor change is
 * also written to logs.students, so the Interactions service sees the same instructor.
 */

export type Kind = "instructor" | "coach";
export type StaffOption = { id: string; name: string; email: string; code: string | null };

type Result = { ok: true; message: string } | { ok: false; error: string };

const fromDb = () => authMode() === "database";

/** Active staff who can take students: instructors (with an Interactions code) and success coaches. */
export async function staffOptions(): Promise<Record<Kind, StaffOption[]>> {
  if (!fromDb()) return { instructor: [], coach: [] };
  return cachedStaffOptions();
}

async function cachedStaffOptions(): Promise<Record<Kind, StaffOption[]>> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.staff);
  const { rows } = await getDb().query<{ id: string; name: string; email: string; code: string | null; roles: { module: string; role: string }[] }>(
    `SELECT s.id::text, s.name, lower(s.email::text) AS email, s.instructor_code AS code,
            COALESCE((SELECT json_agg(json_build_object('module', r.module, 'role', r.role)) FROM core.staff_roles r WHERE r.staff_id = s.id), '[]') AS roles
     FROM core.staff s WHERE s.active AND s.left_on IS NULL ORDER BY s.name`,
  );
  const out: Record<Kind, StaffOption[]> = { instructor: [], coach: [] };
  for (const r of rows) {
    const role = platformRole(r.roles);
    const option = { id: r.id, name: r.name, email: r.email, code: r.code };
    if ((role === "instructor" || role === "senior_instructor") && r.code) out.instructor.push(option);
    if (role === "success_coach") out.coach.push(option);
  }
  return out;
}

/** The change itself, inside the caller's withChange() transaction. Returns whether anything changed. */
async function applyOne(db: Db, niatId: string, kind: Kind, staff: StaffOption | null): Promise<boolean> {
  const { rows } = await db.query<{ changed: boolean }>("SELECT core.assign_staff($1, $2, $3) AS changed", [
    niatId,
    kind,
    staff ? Number(staff.id) : null,
  ]);
  if (kind === "instructor") {
    // Keep the Interactions service's own field in step (its trigger then finds core already up to date).
    await db.query(
      `UPDATE logs.students st
       SET instructor_id = i.id, instructor_raw = COALESCE(i.first_name, ''), instructor_match = CASE WHEN i.id IS NULL THEN 'unmatched' ELSE 'matched' END,
           updated_at = now()
       FROM (SELECT $2::text AS code) x LEFT JOIN logs.instructors i ON i.id = x.code
       WHERE upper(st.id) = $1 AND st.instructor_id IS DISTINCT FROM i.id`,
      [niatId, staff?.code ?? null],
    );
  }
  return rows[0]?.changed ?? false;
}

function permissionError(user: SessionUser): string | null {
  if (!fromDb()) return "Changing assignments needs the database.";
  if (!hasPanel(user.role)) return "Only admins and senior instructors change assignments.";
  return null;
}

export async function assignStudent(user: SessionUser, niatId: string, kind: Kind, staffId: string | null, detail: string | null = null): Promise<Result> {
  const problem = permissionError(user);
  if (problem) return { ok: false, error: problem };
  const student = (await getRoster()).find((s) => s.niatId === niatId.toUpperCase());
  if (!student) return { ok: false, error: "That student isn't on the roster." };
  const options = (await staffOptions())[kind];
  const staff = staffId ? (options.find((o) => o.id === staffId) ?? null) : null;
  if (staffId && !staff) {
    return { ok: false, error: kind === "instructor" ? "Pick an active instructor (with an Interactions instructor code)." : "Pick an active success coach." };
  }
  const changed = await withChange(user, "ui", detail, (db) => applyOne(db, student.niatId, kind, staff));
  if (!changed) return { ok: true, message: "No change." };
  expire(TAGS.staff); // student counts per person
  return { ok: true, message: `${student.name}: ${kind === "coach" ? "coach" : "instructor"} ${staff ? `is now ${staff.name}` : "removed"}.` };
}

// ---------------------------------------------------------------- history, undo and restore

export type HistoryPeriod = { staffId: string; name: string; from: string; to: string | null; available: boolean };
export type HistoryEvent = {
  id: string;
  at: string;
  before: { staffId: string | null; name: string | null };
  after: { staffId: string | null; name: string | null };
  by: string;
  source: string;
  detail: string | null;
};
export type KindHistory = {
  current: { staffId: string | null; name: string | null };
  events: HistoryEvent[];
  periods: HistoryPeriod[];
  /** People who can be set again (active, and for instructors with an Interactions code). */
  available: string[];
};
export type AssignmentHistory = { niatId: string; student: string; instructor: KindHistory; coach: KindHistory };

const SOURCE: Record<string, string> = {
  ui: "NxtOne",
  excel: "Excel import",
  "interactions-api": "Interactions app",
  "attendance-api": "DSA attendance app",
  database: "Database edit",
  migration: "Data migration",
};

/**
 * One student's instructor and coach history: every change (from core.change_log, with who and
 * from where) and every assignment period (core.student_assignments). Senior instructors see a
 * change by an admin or super admin as "an admin".
 */
export async function assignmentHistory(user: SessionUser, niatId: string): Promise<{ ok: true; history: AssignmentHistory } | { ok: false; error: string }> {
  const problem = permissionError(user);
  if (problem) return { ok: false, error: problem };
  const id = niatId.trim().toUpperCase();
  const student = (await getRoster()).find((s) => s.niatId === id);
  if (!student) return { ok: false, error: "That student isn't on the roster." };
  const db = getDb();
  const [periods, events] = await Promise.all([
    db.query<{ kind: Kind; staff_id: string; name: string; active: boolean; deleted: boolean; from_date: string; to_date: string | null }>(
      `SELECT a.kind, a.staff_id::text, st.name, st.active AND st.left_on IS NULL AS active, st.deleted_at IS NOT NULL AS deleted,
              a.from_date::text, a.to_date::text
       FROM core.student_assignments a JOIN core.staff st ON st.id = a.staff_id
       WHERE a.niat_id = $1 AND a.kind IN ('instructor', 'coach')
       ORDER BY a.to_date IS NULL DESC, a.from_date DESC`,
      [id],
    ),
    db.query<{ id: string; at: string; txid: string; field: Kind; action: string; staff_id: string | null; old_value: string | null; new_value: string | null; detail: Record<string, unknown>; actor_name: string | null; actor_role: string | null; source: string; source_detail: string | null }>(
      `SELECT id::text, at, txid::text, field, action, staff_id::text, old_value, new_value, detail, actor_name, actor_role, source, source_detail
       FROM core.change_log WHERE entity = 'student_assignment' AND niat_id = $1 AND field IN ('instructor', 'coach')
       ORDER BY at DESC, id DESC LIMIT 200`,
      [id],
    ),
  ]);
  const options = await staffOptions();
  const nameOf = new Map<string, string>(periods.rows.map((p) => [p.staff_id, p.name]));
  const masked = user.role === "senior_instructor";

  const build = (kind: Kind): KindHistory => {
    const own = events.rows.filter((e) => e.field === kind);
    const out: HistoryEvent[] = [];
    const used = new Set<string>();
    for (const e of own) {
      if (used.has(e.id)) continue;
      used.add(e.id);
      // An "ended" + "assigned" pair in one transaction is one change.
      const pair = own.find((x) => !used.has(x.id) && x.txid === e.txid && ((e.action === "ended" && x.action === "assigned") || (e.action === "assigned" && x.action === "ended")));
      if (pair) used.add(pair.id);
      const ended = e.action === "ended" ? e : pair?.action === "ended" ? pair : null;
      const assigned = e.action === "assigned" ? e : pair?.action === "assigned" ? pair : null;
      let before: HistoryEvent["before"] = { staffId: null, name: null };
      let after: HistoryEvent["after"] = { staffId: null, name: null };
      if (e.action === "changed") {
        const prev = e.detail?.previous_staff_id ? String(e.detail.previous_staff_id) : null;
        before = { staffId: prev, name: e.old_value };
        after = { staffId: e.staff_id, name: e.new_value };
      } else if (e.action === "removed") {
        before = { staffId: e.staff_id, name: e.old_value };
      } else {
        if (ended) before = { staffId: ended.staff_id, name: ended.old_value };
        if (assigned) after = { staffId: assigned.staff_id, name: assigned.new_value };
      }
      if (e.action === "dates_changed") continue;
      const byAdmin = e.actor_role === "owner" || e.actor_role === "admin";
      out.push({
        id: e.id,
        at: new Date(e.at).toISOString(),
        before,
        after,
        by: masked && byAdmin ? "an admin" : (e.actor_name ?? (e.source === "database" ? "Direct database edit" : "System")),
        source: SOURCE[e.source] ?? e.source,
        detail: masked && byAdmin ? null : e.source_detail,
      });
    }
    const available = new Set(options[kind].map((o) => o.id));
    const current = periods.rows.find((p) => p.kind === kind && !p.to_date);
    return {
      current: current ? { staffId: current.staff_id, name: current.name } : { staffId: null, name: null },
      events: out.map((ev) => ({
        ...ev,
        before: { ...ev.before, name: ev.before.name ?? (ev.before.staffId ? (nameOf.get(ev.before.staffId) ?? null) : null) },
      })),
      periods: periods.rows
        .filter((p) => p.kind === kind)
        .map((p) => ({ staffId: p.staff_id, name: p.name, from: p.from_date, to: p.to_date, available: available.has(p.staff_id) && !p.deleted })),
      available: [...available],
    };
  };

  return { ok: true, history: { niatId: id, student: student.name, instructor: build("instructor"), coach: build("coach") } };
}

/** Undo a change or set a past assignment again; a new, logged change (history is never rewritten). */
export async function restoreAssignment(user: SessionUser, niatId: string, kind: Kind, staffId: string | null, how: "undo" | "restore"): Promise<Result> {
  return assignStudent(user, niatId, kind, staffId, how === "undo" ? "undo from history" : "restored from history");
}

// ---------------------------------------------------------------- Excel / CSV import

export type ImportRow = {
  line: number;
  niatId: string;
  student: string | null;
  instructor: { from: string; to: string | null } | null;
  coach: { from: string; to: string | null } | null;
  error: string | null;
};
export type ImportPreview = { id: string; fileName: string; rows: ImportRow[]; changes: number; errors: number; unchanged: number };

const HEADERS = {
  niat: ["niat id", "niat_id", "niatid", "roll no", "roll number", "roll_no", "student id"],
  instructor: ["instructor", "instructor email", "instructor code", "instructor name"],
  coach: ["coach", "success coach", "coach email", "coach name"],
};
const norm = (v: unknown) => String(v ?? "").trim();

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function readTable(fileName: string, data: Buffer): Promise<string[][]> {
  if (/\.csv$/i.test(fileName)) return parseCsv(data.toString("utf8").replace(/^﻿/, ""));
  if (/\.xlsx$/i.test(fileName)) return (await readSheet(data)).map((row) => row.map((cell) => norm(cell)));
  throw new Error("unsupported");
}

/**
 * Blank import file: the header the importer reads, plus example rows. The examples use
 * made-up NIAT IDs, so if someone uploads them by mistake they are skipped as "Not on the roster".
 */
export function assignmentTemplateCsv(): string {
  return toCsv(
    ["NIAT ID", "Instructor", "Coach"],
    [
      ["EXAMPLE-1", "instructor.email@nxtwave.co.in", ""],
      ["EXAMPLE-2", "INS012", "none"],
      ["EXAMPLE-3", "", "Coach Full Name"],
    ],
  );
}

/**
 * Every student with their current instructor and coach, ready to edit and upload again.
 * A person is written by name, or by email when two active people share the name. A person who
 * is no longer active is left blank (blank = leave as is), so re-uploading the file unchanged
 * gives no errors. Student and Class are for reading only; the importer ignores those columns.
 */
export async function assignmentsCsv(user: SessionUser): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  if (!hasPanel(user.role)) return { ok: false, error: "Only admins and senior instructors change assignments." };
  const [roster, options] = await Promise.all([getRoster(), staffOptions()]);
  const cell = (name: string, list: StaffOption[]) => {
    if (!name || name === "Unassigned") return "";
    if (!list.length) return name; // sample data: no staff table to check against
    const same = list.filter((o) => o.name.toLowerCase() === name.toLowerCase()); // how the importer matches names
    if (same.length === 1) return name;
    const exact = same.filter((o) => o.name === name);
    return exact.length === 1 ? exact[0].email : "";
  };
  return {
    ok: true,
    csv: toCsv(
      ["NIAT ID", "Student", "Class", "Instructor", "Coach"],
      roster.map((s) => [s.niatId, s.name, `${s.college} · ${s.section} · ${s.hall}`, cell(s.instructor, options.instructor), cell(s.coach, options.coach)]),
    ),
  };
}

/** Matches a cell to a person: email, instructor code (e.g. INS012) or exact full name. */
function resolveStaff(value: string, options: StaffOption[]): { staff: StaffOption | null; error: string | null } {
  const v = value.trim().toLowerCase();
  if (!v || v === "-" || v === "none") return { staff: null, error: null };
  const hits = options.filter((o) => o.email === v || o.code?.toLowerCase() === v || o.name.toLowerCase() === v);
  if (hits.length === 1) return { staff: hits[0], error: null };
  return { staff: null, error: hits.length ? `"${value}" matches more than one person; use their email.` : `"${value}" isn't an active person in this role.` };
}

export async function previewAssignmentImport(user: SessionUser, fileName: string, data: Buffer): Promise<{ ok: true; preview: ImportPreview } | { ok: false; error: string }> {
  const problem = permissionError(user);
  if (problem) return { ok: false, error: problem };
  let table: string[][];
  try {
    table = (await readTable(fileName, data)).filter((r) => r.some((c) => c.trim()));
  } catch {
    return { ok: false, error: "Upload an Excel (.xlsx) or CSV file. Older .xls files: save as .xlsx first." };
  }
  if (table.length < 2) return { ok: false, error: "The file has no rows under the header." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const niatCol = col(HEADERS.niat);
  const insCol = col(HEADERS.instructor);
  const coachCol = col(HEADERS.coach);
  if (niatCol < 0) return { ok: false, error: 'Add a "NIAT ID" column, or use "Download blank template" above.' };
  if (insCol < 0 && coachCol < 0) return { ok: false, error: 'Add an "Instructor" and/or a "Coach" column (email, instructor code or full name), or use "Download blank template" above.' };
  if (table.length - 1 > 3000) return { ok: false, error: "Up to 3,000 rows per file." };

  const roster = new Map((await getRoster()).map((s) => [s.niatId, s]));
  const options = await staffOptions();
  const seen = new Set<string>();
  const rows: ImportRow[] = table.slice(1).map((cells, i) => {
    const niatId = norm(cells[niatCol]).toUpperCase();
    const s = roster.get(niatId);
    const row: ImportRow = { line: i + 2, niatId, student: s?.name ?? null, instructor: null, coach: null, error: null };
    if (!s) return { ...row, error: niatId ? "Not on the roster." : "No NIAT ID." };
    if (seen.has(niatId)) return { ...row, error: "This student is in the file twice." };
    seen.add(niatId);
    const errors: string[] = [];
    if (insCol >= 0 && norm(cells[insCol])) {
      const r = resolveStaff(norm(cells[insCol]), options.instructor);
      if (r.error) errors.push(`Instructor: ${r.error}`);
      else if ((r.staff?.name ?? "Unassigned") !== s.instructor) row.instructor = { from: s.instructor, to: r.staff?.name ?? null };
    }
    if (coachCol >= 0 && norm(cells[coachCol])) {
      const r = resolveStaff(norm(cells[coachCol]), options.coach);
      if (r.error) errors.push(`Coach: ${r.error}`);
      else if ((r.staff?.name ?? "") !== s.coach) row.coach = { from: s.coach || "None", to: r.staff?.name ?? null };
    }
    return { ...row, error: errors.length ? errors.join(" ") : null };
  });

  const changes = rows.filter((r) => !r.error && (r.instructor || r.coach)).length;
  const errors = rows.filter((r) => r.error).length;
  const summary = { changes, errors, unchanged: rows.length - changes - errors };
  const stored = rows.map((r) => ({
    ...r,
    // Resolved ids, so applying uses exactly what was previewed.
    instructorId: r.instructor ? (options.instructor.find((o) => o.name === r.instructor!.to)?.id ?? null) : undefined,
    coachId: r.coach ? (options.coach.find((o) => o.name === r.coach!.to)?.id ?? null) : undefined,
  }));
  const { rows: saved } = await getDb().query<{ id: string }>(
    `INSERT INTO core.roster_imports (file_name, uploaded_by, status, summary, rows)
     VALUES ($1, $2, 'previewed', $3, $4) RETURNING id::text`,
    [fileName.slice(0, 200), /^\d+$/.test(user.id) ? user.id : null, JSON.stringify({ kind: "assignments", ...summary }), JSON.stringify(stored)],
  );
  return { ok: true, preview: { id: saved[0].id, fileName, rows, ...summary } };
}

export async function applyAssignmentImport(user: SessionUser, importId: string): Promise<Result> {
  const problem = permissionError(user);
  if (problem) return { ok: false, error: problem };
  if (!/^\d+$/.test(importId)) return { ok: false, error: "Unknown import." };
  const { rows } = await getDb().query<{ file_name: string; status: string; summary: { kind?: string }; rows: (ImportRow & { instructorId?: string | null; coachId?: string | null })[] }>(
    "SELECT file_name, status, summary, rows FROM core.roster_imports WHERE id = $1",
    [importId],
  );
  const imp = rows[0];
  if (!imp || imp.summary.kind !== "assignments") return { ok: false, error: "Unknown import." };
  if (imp.status !== "previewed") return { ok: false, error: "This file was already applied or discarded. Upload it again." };

  const options = await staffOptions();
  const byId = (kind: Kind, id: string | null | undefined) => (id ? (options[kind].find((o) => o.id === id) ?? null) : null);
  const source: ChangeSource = "excel";
  const changed = await withChange(user, source, `${imp.file_name} (import #${importId})`, async (db) => {
    let n = 0;
    for (const r of imp.rows) {
      if (r.error) continue;
      if (r.instructor && (await applyOne(db, r.niatId, "instructor", byId("instructor", r.instructorId)))) n++;
      if (r.coach && (await applyOne(db, r.niatId, "coach", byId("coach", r.coachId)))) n++;
    }
    await db.query("UPDATE core.roster_imports SET status = 'committed' WHERE id = $1 AND status = 'previewed'", [importId]);
    return n;
  });
  expire(TAGS.staff);
  return { ok: true, message: `Applied ${changed} change${changed === 1 ? "" : "s"} from ${imp.file_name}.` };
}
