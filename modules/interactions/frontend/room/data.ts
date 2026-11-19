/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomInt } from "node:crypto";
import { authMode } from "@/common/auth/config";
import type { SessionUser } from "@/common/auth/roles";
import { getOptionalSessionUser } from "@/common/auth/session";
import { getOptionalStudent, type StudentUser } from "@/common/auth/student/session";
import { getDb } from "@/common/db/pool";
import type { Language, RoomOp, RoomProblem, RoomState, RoomViewer } from "./lib/types";
import { roomName, STAFF_OPS } from "./lib/types";

/**
 * Code rooms (core.code_rooms / core.code_room_problems): a shared editor for one student during an
 * interaction. Staff start and manage rooms; the student can open only their
 * own rooms, signed in. Nothing here runs code.
 */

export const roomsAvailable = () => authMode() === "database";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const newRoomId = () => Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// ---------------------------------------------------------------- reading

type RoomRow = {
  id: string;
  version: string;
  niat_id: string;
  student_name: string;
  created_by_name: string;
  created_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  interaction_id: string | null;
};
type ProblemRow = { id: string; language: string; code: string; version: number; updated_by_name: string | null; updated_at: string };

export async function loadRoom(id: string): Promise<RoomState | null> {
  if (!/^[A-Za-z0-9]{12}$/.test(id)) return null;
  const db = getDb();
  const [room, problems] = await Promise.all([
    db.query<RoomRow>(
      `SELECT r.id, r.version::text, r.niat_id, s.full_name AS student_name, r.created_by_name, r.created_at, r.closed_at, r.closed_by_name,
              r.interaction_id
       FROM core.code_rooms r JOIN core.students s ON s.niat_id = r.niat_id WHERE r.id = $1`,
      [id],
    ),
    db.query<ProblemRow>(
      "SELECT id, language, code, version, updated_by_name, updated_at FROM core.code_room_problems WHERE room_id = $1 ORDER BY position LIMIT 1",
      [id],
    ),
  ]);
  const r = room.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    version: Number(r.version),
    niatId: r.niat_id,
    studentName: r.student_name,
    createdBy: r.created_by_name,
    createdAt: new Date(r.created_at).toISOString(),
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    closedBy: r.closed_by_name,
    interactionId: r.interaction_id,
    problems: problems.rows.map(
      (p): RoomProblem => ({
        id: p.id,
        language: p.language as Language,
        code: p.code,
        version: p.version,
        updatedBy: p.updated_by_name,
        updatedAt: new Date(p.updated_at).toISOString(),
      }),
    ),
  };
}

/** Just the room's version and student, for the live poll (nothing changed → nothing else is read). */
export async function roomHead(id: string): Promise<{ version: number; niatId: string } | null> {
  if (!/^[A-Za-z0-9]{12}$/.test(id)) return null;
  const { rows } = await getDb().query<{ version: string; niat_id: string }>("SELECT version::text, niat_id FROM core.code_rooms WHERE id = $1", [id]);
  return rows[0] ? { version: Number(rows[0].version), niatId: rows[0].niat_id } : null;
}

export type RoomAccess =
  | { ok: true; viewer: RoomViewer; staff: SessionUser | null; student: StudentUser | null }
  | { ok: false; reason: "signed-out" | "forbidden" | "set-password" | "change-password" };

/**
 * Who may open a room for student `niatId`: any signed-in staff member, or that student.
 * A staff session wins when both somehow exist.
 */
export async function roomAccess(niatId: string): Promise<RoomAccess> {
  const staff = await getOptionalSessionUser();
  if (staff) {
    if (staff.mustSetPassword) return { ok: false, reason: "set-password" };
    return { ok: true, viewer: { kind: "staff", name: staff.name }, staff, student: null };
  }
  const student = await getOptionalStudent();
  if (!student) return { ok: false, reason: "signed-out" };
  if (student.niatId !== niatId) return { ok: false, reason: "forbidden" };
  if (student.mustChangePassword) return { ok: false, reason: "change-password" };
  return { ok: true, viewer: { kind: "student", name: student.name }, staff: null, student };
}

/** Rooms of one student, newest first (student page and portal). */
export async function roomsForStudent(niatId: string): Promise<{ id: string; createdAt: string; createdBy: string; closedAt: string | null; interactionId: string | null }[]> {
  if (!roomsAvailable()) return [];
  const { rows } = await getDb().query<{ id: string; created_at: string; created_by_name: string; closed_at: string | null; interaction_id: string | null }>(
    `SELECT r.id, r.created_at, r.created_by_name, r.closed_at, r.interaction_id
     FROM core.code_rooms r WHERE r.niat_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
    [niatId],
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    createdBy: r.created_by_name,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    interactionId: r.interaction_id,
  }));
}

/** Code room saved with each of these interactions: interaction id → room id. */
export async function roomsByInteraction(interactionIds: string[]): Promise<Record<string, string>> {
  if (!roomsAvailable() || !interactionIds.length) return {};
  const { rows } = await getDb().query<{ id: string; interaction_id: string }>(
    "SELECT id, interaction_id FROM core.code_rooms WHERE interaction_id = ANY($1::text[])",
    [interactionIds],
  );
  return Object.fromEntries(rows.map((r) => [r.interaction_id, r.id]));
}

/** A student's rooms that are open now (started in the last 12 hours), for the "Join" banner. */
export async function openRoomsFor(niatId: string): Promise<{ id: string; createdBy: string }[]> {
  if (!roomsAvailable()) return [];
  const { rows } = await getDb().query<{ id: string; created_by_name: string }>(
    `SELECT id, created_by_name FROM core.code_rooms
     WHERE niat_id = $1 AND closed_at IS NULL AND created_at > now() - interval '12 hours' ORDER BY created_at DESC`,
    [niatId],
  );
  return rows.map((r) => ({ id: r.id, createdBy: r.created_by_name }));
}

// ---------------------------------------------------------------- writing

type Fail = { ok: false; error: string; status: number };

/** Starts a room for a student (or returns this person's open room for them from today). */
export async function startRoom(user: SessionUser, niatId: string): Promise<{ ok: true; id: string } | Fail> {
  if (!roomsAvailable()) return { ok: false, error: "Code rooms need the database.", status: 503 };
  const db = getDb();
  const student = await db.query<{ niat_id: string }>("SELECT niat_id FROM core.students WHERE niat_id = $1", [niatId.toUpperCase()]);
  if (!student.rows[0]) return { ok: false, error: "That student isn't in the roster.", status: 404 };
  const open = await db.query<{ id: string }>(
    `SELECT id FROM core.code_rooms
     WHERE niat_id = $1 AND created_by_name = $2 AND closed_at IS NULL AND created_at > now() - interval '12 hours'
     ORDER BY created_at DESC LIMIT 1`,
    [niatId.toUpperCase(), user.name],
  );
  if (open.rows[0]) return { ok: true, id: open.rows[0].id };
  const id = newRoomId();
  const { rows } = await db.query<{ created_at: string }>(
    "INSERT INTO core.code_rooms (id, niat_id, created_by, created_by_name) VALUES ($1, $2, $3, $4) RETURNING created_at",
    [id, niatId.toUpperCase(), Number(user.id) || null, user.name],
  );
  await db.query("INSERT INTO core.code_room_problems (room_id, position, title, updated_by_name) VALUES ($1, 1, $2, $3)", [
    id,
    roomName(new Date(rows[0].created_at).toISOString()),
    user.name,
  ]);
  return { ok: true, id };
}

export type OpResult = { ok: true; version: number; problemVersion?: number } | { ok: false; error: string; status: number; conflict?: RoomProblem };

/** Applies one change. Code edits carry the version they started from; a stale one gets the current code back. */
export async function applyOp(room: RoomState, viewer: RoomViewer, op: RoomOp): Promise<OpResult> {
  if (viewer.kind !== "staff" && STAFF_OPS.includes(op.op)) return { ok: false, error: "Only the instructor can do that.", status: 403 };
  if (room.closedAt && op.op !== "reopen") return { ok: false, error: "This room has ended. The code is read-only now.", status: 409 };
  const db = getDb();
  const bump = async () => {
    const { rows } = await db.query<{ version: string }>("UPDATE core.code_rooms SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version::text", [room.id]);
    return Number(rows[0].version);
  };
  const problem = "problemId" in op ? room.problems.find((p) => p.id === op.problemId) : undefined;
  if ("problemId" in op && !problem) return { ok: false, error: "That code pad isn't in this room.", status: 404 };

  switch (op.op) {
    case "code": {
      const { rows } = await db.query<{ version: number }>(
        `UPDATE core.code_room_problems SET code = $3, version = version + 1, updated_at = now(), updated_by_name = $4
         WHERE id = $1 AND room_id = $2 AND version = $5 RETURNING version`,
        [op.problemId, room.id, op.code, viewer.name, op.base],
      );
      if (!rows[0]) {
        const fresh = (await loadRoom(room.id))?.problems.find((p) => p.id === op.problemId);
        return { ok: false, error: "Someone else changed this code; merge and retry.", status: 409, conflict: fresh };
      }
      return { ok: true, version: await bump(), problemVersion: rows[0].version };
    }
    case "language":
      await db.query("UPDATE core.code_room_problems SET language = $3 WHERE id = $1 AND room_id = $2", [op.problemId, room.id, op.language]);
      return { ok: true, version: await bump() };
    case "close":
      await db.query("UPDATE core.code_rooms SET closed_at = now(), closed_by_name = $2 WHERE id = $1 AND closed_at IS NULL", [room.id, viewer.name]);
      return { ok: true, version: await bump() };
    case "reopen":
      if (room.interactionId) return { ok: false, error: "This room is saved with an interaction and stays read-only.", status: 409 };
      await db.query("UPDATE core.code_rooms SET closed_at = NULL, closed_by_name = NULL WHERE id = $1", [room.id]);
      return { ok: true, version: await bump() };
  }
}

/**
 * After an interaction is saved: attach the room to it and end the room (only the room's own
 * student). Without a room id (say the form was reloaded), this person's latest room for the
 * student from the last 12 hours that isn't attached yet is used.
 */
export async function attachRoom(user: SessionUser, roomId: string | null, niatId: string, interactionId: string): Promise<boolean> {
  if (!roomsAvailable()) return false;
  if (roomId && !/^[A-Za-z0-9]{12}$/.test(roomId)) roomId = null;
  const { rows } = await getDb().query<{ id: string }>(
    `UPDATE core.code_rooms SET interaction_id = $3, closed_at = COALESCE(closed_at, now()), closed_by_name = COALESCE(closed_by_name, $4),
            version = version + 1, updated_at = now()
     WHERE id = COALESCE($1, (SELECT id FROM core.code_rooms
                              WHERE niat_id = $2 AND created_by_name = $4 AND interaction_id IS NULL AND created_at > now() - interval '12 hours'
                              ORDER BY created_at DESC LIMIT 1))
       AND niat_id = $2 AND interaction_id IS NULL RETURNING id`,
    [roomId, niatId.toUpperCase(), interactionId, user.name],
  );
  return rows.length > 0;
}
