/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import type { SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";
import { withChange } from "@/common/db/change";
import { getRoster } from "@/common/data/roster";
import type { RosterStudent } from "@/common/sample-data/roster";

/**
 * Top K: the students each instructor counts among their best (core.top_k; NxtRank kept them as
 * Group = "Top K"). Whose Top K a student is follows the student's instructor (POC), so it moves with
 * them. The student's instructor marks their own students; senior instructors, admins and super
 * admins mark anyone. No fixed K.
 */

export type TopKMark = { niatId: string; markedBy: string; markedAt: string; source: "nxtone" | "nxtrank" };
export type TopKStudent = RosterStudent & { mark: TopKMark };

/** Senior instructors, admins and super admins see and mark every Top K student. */
export const seesAllTopK = (user: Pick<SessionUser, "role">) => user.role === "owner" || user.role === "admin" || user.role === "senior_instructor";

export function canMarkTopK(user: Pick<SessionUser, "role" | "name">, student: Pick<RosterStudent, "instructor">) {
  return seesAllTopK(user) || (user.role === "instructor" && student.instructor === user.name);
}

// ---------------------------------------------------------------- sample data (no database)

const g = globalThis as unknown as { __topK?: Map<string, TopKMark> };
async function sampleMarks(): Promise<Map<string, TopKMark>> {
  if (!g.__topK) {
    g.__topK = new Map();
    // A few per instructor to start, like the NxtRank import.
    const byInstructor = new Map<string, number>();
    for (const s of await getRoster()) {
      const n = byInstructor.get(s.instructor) ?? 0;
      if (n < 2 && s.attendance30d !== null && s.attendance30d >= 80) {
        g.__topK.set(s.niatId, { niatId: s.niatId, markedBy: "NxtRank import", markedAt: "2026-11-27T10:00:00+05:30", source: "nxtrank" });
        byInstructor.set(s.instructor, n + 1);
      }
    }
  }
  return g.__topK;
}

// ---------------------------------------------------------------- database

/** Whether core.top_k exists yet (migration 20261127000002_top_k). */
export async function topKReady(): Promise<boolean> {
  if (authMode() !== "database") return true;
  const { rows } = await getDb().query<{ t: string | null }>("SELECT to_regclass('core.top_k')::text AS t");
  return !!rows[0]?.t;
}

async function marks(): Promise<Map<string, TopKMark>> {
  if (authMode() !== "database") return sampleMarks();
  if (!(await topKReady())) return new Map();
  const { rows } = await getDb().query<{ niat_id: string; marked_by: string; marked_at: string; source: "nxtone" | "nxtrank" }>(
    "SELECT niat_id, marked_by, marked_at, source FROM core.top_k",
  );
  return new Map(rows.map((r) => [r.niat_id, { niatId: r.niat_id, markedBy: r.marked_by, markedAt: new Date(r.marked_at).toISOString(), source: r.source }]));
}

/** Every Top K student this person may see, with their roster details: their own students' for an instructor, everyone's otherwise. */
export async function listTopK(user: SessionUser): Promise<TopKStudent[]> {
  const [roster, marked] = await Promise.all([getRoster(), marks()]);
  return roster
    .filter((s) => marked.has(s.niatId) && (seesAllTopK(user) || s.instructor === user.name))
    .map((s) => ({ ...s, mark: marked.get(s.niatId)! }))
    .sort((a, b) => a.instructor.localeCompare(b.instructor) || a.name.localeCompare(b.name));
}

/** NIAT IDs of the Top K students this person sees (for contest scopes). */
export async function topKIds(user: SessionUser): Promise<string[]> {
  return (await listTopK(user)).map((s) => s.niatId);
}

/** Students this person may still add to Top K (their own for instructors; everyone for seniors / admins). */
export async function topKCandidates(user: SessionUser): Promise<RosterStudent[]> {
  const [roster, marked] = await Promise.all([getRoster(), marks()]);
  return roster.filter((s) => !marked.has(s.niatId) && canMarkTopK(user, s));
}

export type MarkResult = { ok: true; changed: number } | { ok: false; error: string };

/** Marks (on) or unmarks students as Top K. Each must be one this person may mark. */
export async function setTopK(user: SessionUser, niatIds: string[], on: boolean): Promise<MarkResult> {
  const ids = [...new Set(niatIds.map((id) => id.trim().toUpperCase()).filter(Boolean))];
  if (!ids.length) return { ok: false, error: "Pick at least one student." };
  const roster = new Map((await getRoster()).map((s) => [s.niatId, s]));
  const refused = ids.filter((id) => !roster.has(id) || !canMarkTopK(user, roster.get(id)!));
  if (refused.length) {
    return { ok: false, error: user.role === "instructor" ? "You can mark only your own students." : `Not on the roster: ${refused.join(", ")}.` };
  }
  if (authMode() !== "database") {
    const m = await sampleMarks();
    let changed = 0;
    for (const id of ids) {
      if (on && !m.has(id)) {
        m.set(id, { niatId: id, markedBy: user.name, markedAt: new Date().toISOString(), source: "nxtone" });
        changed++;
      } else if (!on && m.delete(id)) changed++;
    }
    return { ok: true, changed };
  }
  if (!(await topKReady())) return { ok: false, error: "Top K isn't set up on this database yet." };
  const changed = await withChange(user, "ui", "Top K", async (db) => {
    const r = on
      ? await db.query(
          `INSERT INTO core.top_k (niat_id, marked_by, source) SELECT unnest($1::text[]), $2, 'nxtone' ON CONFLICT (niat_id) DO NOTHING RETURNING niat_id`,
          [ids, user.name],
        )
      : await db.query("DELETE FROM core.top_k WHERE niat_id = ANY($1::text[]) RETURNING niat_id", [ids]);
    return r.rows.length;
  });
  return { ok: true, changed };
}
