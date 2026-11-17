/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomInt } from "node:crypto";
import { authMode } from "@/common/auth/config";
import { hashPassword } from "@/common/auth/core/password";
import { isAdminRole, type SessionUser } from "@/common/auth/roles";
import { getRoster } from "@/common/data/roster";
import { withChange } from "@/common/db/change";
import { getDb } from "@/common/db/pool";

/**
 * Student sign-in management (admins and super admins). Issuing a password stores only its hash,
 * signs the student out everywhere and makes them choose their own at next sign-in. Every
 * issue, reset and on/off switch goes to the change log with the admin's name.
 */

export type AccountStatus = "none" | "waiting" | "active" | "disabled";
export type AccessRow = { niatId: string; name: string; college: string; section: string; hall: string; status: AccountStatus; lastSignIn: string | null };
export type Issued = { niatId: string; name: string; password: string };
type Fail = { ok: false; error: string };

export const MAX_ISSUE = 200;
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/l/I

/** A temporary password like "Kp7m-x9Qa-Rt4v": easy to read out, 71 bits of randomness. */
export function temporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export async function listAccess(viewer: SessionUser): Promise<AccessRow[] | null> {
  if (authMode() !== "database" || !isAdminRole(viewer.role)) return null;
  const [roster, { rows }] = await Promise.all([
    getRoster(),
    getDb().query<{ niat_id: string; active: boolean; must_change_password: boolean; last_sign_in_at: string | null }>(
      "SELECT niat_id, active, must_change_password, last_sign_in_at FROM core.student_accounts",
    ),
  ]);
  const byId = new Map(rows.map((r) => [r.niat_id, r]));
  return roster.map((s) => {
    const a = byId.get(s.niatId);
    const status: AccountStatus = !a ? "none" : !a.active ? "disabled" : a.must_change_password ? "waiting" : "active";
    return {
      niatId: s.niatId,
      name: s.name,
      college: s.college,
      section: s.section,
      hall: s.hall,
      status,
      lastSignIn: a?.last_sign_in_at ? new Date(a.last_sign_in_at).toISOString() : null,
    };
  });
}

/** New temporary passwords for these students (creating their sign-in if needed). Shown once, never stored. */
export async function issuePasswords(viewer: SessionUser, niatIds: string[]): Promise<{ ok: true; issued: Issued[] } | Fail> {
  if (authMode() !== "database") return { ok: false, error: "Student sign-in needs the database." };
  if (!isAdminRole(viewer.role)) return { ok: false, error: "Only admins manage student sign-in." };
  const ids = [...new Set(niatIds.map((id) => id.trim().toUpperCase()))];
  if (!ids.length) return { ok: false, error: "Pick at least one student." };
  if (ids.length > MAX_ISSUE) return { ok: false, error: `Up to ${MAX_ISSUE} students at a time.` };
  const roster = new Map((await getRoster()).map((s) => [s.niatId, s]));
  const unknown = ids.filter((id) => !roster.has(id));
  if (unknown.length) return { ok: false, error: `Not on the roster: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}` };

  const issued = ids.map((id) => ({ niatId: id, name: roster.get(id)!.name, password: temporaryPassword() }));
  const hashes = await Promise.all(issued.map((i) => hashPassword(i.password)));
  await withChange(viewer, "ui", ids.length > 1 ? `issued ${ids.length} student passwords` : null, async (db) => {
    await db.query(
      `INSERT INTO core.student_accounts (niat_id, password_hash, must_change_password, active)
       SELECT x.niat_id, x.hash, true, true FROM jsonb_to_recordset($1::jsonb) AS x(niat_id text, hash text)
       ON CONFLICT (niat_id) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, must_change_password = true, active = true,
             session_version = core.student_accounts.session_version + 1`,
      [JSON.stringify(issued.map((i, n) => ({ niat_id: i.niatId, hash: hashes[n] })))],
    );
    await db.query("DELETE FROM core.student_sessions WHERE niat_id = ANY($1::text[])", [ids]);
  });
  return { ok: true, issued };
}

export async function setStudentAccess(viewer: SessionUser, niatIds: string[], active: boolean): Promise<{ ok: true; message: string } | Fail> {
  if (authMode() !== "database") return { ok: false, error: "Student sign-in needs the database." };
  if (!isAdminRole(viewer.role)) return { ok: false, error: "Only admins manage student sign-in." };
  const ids = [...new Set(niatIds.map((id) => id.trim().toUpperCase()))];
  if (!ids.length) return { ok: false, error: "Pick at least one student." };
  const changed = await withChange(viewer, "ui", ids.length > 1 ? `switched ${active ? "on" : "off"} sign-in for ${ids.length} students` : null, async (db) => {
    const { rows } = await db.query(
      "UPDATE core.student_accounts SET active = $2, session_version = session_version + 1 WHERE niat_id = ANY($1::text[]) AND active <> $2 RETURNING niat_id",
      [ids, active],
    );
    if (!active) await db.query("DELETE FROM core.student_sessions WHERE niat_id = ANY($1::text[])", [ids]);
    return rows.length;
  });
  if (!changed) return { ok: false, error: "Nothing to change: those students have no sign-in yet, or it's already like that." };
  return { ok: true, message: `Sign-in switched ${active ? "on" : "off"} for ${changed} student${changed === 1 ? "" : "s"}${active ? "" : " and signed out everywhere"}.` };
}
