/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import type { WebSocket } from 'ws';
import { getPool } from '../db/pool.ts';
import { codeProblem, LANGUAGES, merge3 } from './rules.ts';

/*
 * Live code rooms. Each room someone has open is kept here in memory: an edit is checked, numbered
 * and sent to everyone in the room at once, and the code is saved to the database at most every
 * FLUSH_MS (one small UPDATE). Every SYNC_MS the room is compared with the database, so changes made
 * elsewhere reach the people in it: the web app ending the room when the interaction is saved, or an
 * edit from a browser still on the older polling sync (merged like any other conflicting edit).
 *
 * One instance of this service serves all rooms (rooms live in its memory). If it restarts, browsers
 * reconnect, the room is read back from the database, and each browser re-sends what it typed since.
 */

const FLUSH_MS = 4_000;
const SYNC_MS = 10_000;
const EVICT_MS = 60_000;
export const MAX_CLIENTS_PER_ROOM = 8;

export type Client = { id: string; socket: WebSocket; name: string; kind: 'staff' | 'student'; readOnly: boolean; alive: boolean; recent: number[] };

type Pad = { id: string; language: string; code: string; version: number; updatedBy: string | null; updatedAt: string };
type Room = {
  id: string;
  closedAt: string | null;
  closedBy: string | null;
  interactionId: string | null;
  pad: Pad;
  /** What the database holds (last saved or last read). */
  saved: { code: string; version: number };
  dirty: boolean;
  busy: boolean;
  lastFlush: number;
  lastSync: number;
  idleSince: number | null;
  clients: Set<Client>;
};

const rooms = new Map<string, Room>();
const loading = new Map<string, Promise<Room | null>>();

type Row = {
  id: string; closed_at: Date | null; closed_by_name: string | null; interaction_id: string | null;
  pad_id: string; language: string; code: string; version: number; updated_by_name: string | null; updated_at: Date;
};

async function readRoom(id: string): Promise<Row | null> {
  const { rows } = await getPool().query<Row>(
    `SELECT r.id, r.closed_at, r.closed_by_name, r.interaction_id,
            p.id AS pad_id, p.language, p.code, p.version, p.updated_by_name, p.updated_at
     FROM core.code_rooms r JOIN core.code_room_problems p ON p.room_id = r.id
     WHERE r.id = $1 ORDER BY p.position LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

async function load(id: string): Promise<Room | null> {
  const r = await readRoom(id);
  if (!r) return null;
  const now = Date.now();
  return {
    id: r.id,
    closedAt: r.closed_at?.toISOString() ?? null,
    closedBy: r.closed_by_name,
    interactionId: r.interaction_id,
    pad: { id: r.pad_id, language: r.language, code: r.code, version: r.version, updatedBy: r.updated_by_name, updatedAt: r.updated_at.toISOString() },
    saved: { code: r.code, version: r.version },
    dirty: false,
    busy: false,
    lastFlush: now,
    lastSync: now,
    idleSince: null,
    clients: new Set(),
  };
}

/** Adds the client to the room (read from the database on first use); null if there's no such room. */
export async function joinRoom(id: string, client: Client): Promise<Room | null> {
  if (!rooms.has(id)) {
    let pending = loading.get(id);
    if (!pending) {
      pending = load(id).finally(() => loading.delete(id));
      loading.set(id, pending);
    }
    const loaded = await pending;
    if (!loaded) return null;
    if (!rooms.has(id)) rooms.set(id, loaded);
  }
  const room = rooms.get(id)!;
  // Kept in memory while nobody had it open: catch up with the database before it's used again.
  const wasIdle = room.idleSince !== null;
  room.clients.add(client);
  room.idleSince = null;
  if (wasIdle) await sync(room);
  return room;
}

export function leaveRoom(room: Room, client: Client) {
  room.clients.delete(client);
  if (!room.clients.size) {
    room.idleSince = Date.now();
    void flush(room);
  }
}

// ------------------------------------------------------------------ messages

const meta = (room: Room) => ({ closedAt: room.closedAt, closedBy: room.closedBy, interactionId: room.interactionId, language: room.pad.language });

function send(client: Client, message: unknown) {
  if (client.socket.readyState === 1) client.socket.send(JSON.stringify(message));
}

function broadcast(room: Room, message: unknown) {
  const data = JSON.stringify(message);
  for (const c of room.clients) if (c.socket.readyState === 1) c.socket.send(data);
}

export function hello(room: Room, client: Client) {
  send(client, { type: 'hello', clientId: client.id, room: meta(room), problem: room.pad, readOnly: client.readOnly });
}

const fail = (client: Client, message: string) => send(client, { type: 'error', message });

/** One message from a browser in the room. */
export async function handle(room: Room, client: Client, message: unknown) {
  if (!message || typeof message !== 'object') return;
  const m = message as Record<string, unknown>;
  const writes = m.type === 'edit' || m.type === 'language' || m.type === 'close' || m.type === 'reopen';
  if (writes && client.readOnly) return fail(client, `You're viewing as ${client.name}, so nothing can be saved.`);
  if (writes && m.type !== 'reopen' && room.closedAt) return fail(client, 'This room has ended. The code is read-only now.');

  switch (m.type) {
    case 'edit': {
      if (m.problemId !== room.pad.id) return fail(client, "That code pad isn't in this room.");
      const problem = codeProblem(m.code);
      if (problem) return fail(client, problem);
      if (m.base !== room.pad.version) return send(client, { type: 'conflict', problem: room.pad });
      room.pad = { ...room.pad, code: m.code as string, version: room.pad.version + 1, updatedBy: client.name, updatedAt: new Date().toISOString() };
      room.dirty = true;
      return broadcast(room, { type: 'code', problem: room.pad, origin: client.id });
    }
    case 'language': {
      if (m.problemId !== room.pad.id || !(LANGUAGES as readonly unknown[]).includes(m.language)) return fail(client, "That language isn't available.");
      await getPool().query(
        `WITH p AS (UPDATE core.code_room_problems SET language = $3 WHERE id = $1 AND room_id = $2 RETURNING room_id)
         UPDATE core.code_rooms r SET version = r.version + 1, updated_at = now() FROM p WHERE r.id = p.room_id`,
        [room.pad.id, room.id, m.language],
      );
      room.pad = { ...room.pad, language: m.language as string };
      return broadcast(room, { type: 'room', room: meta(room) });
    }
    case 'close': {
      if (client.kind !== 'staff') return fail(client, 'Only the instructor can do that.');
      await flush(room);
      await getPool().query(
        "UPDATE core.code_rooms SET closed_at = now(), closed_by_name = $2, version = version + 1, updated_at = now() WHERE id = $1 AND closed_at IS NULL",
        [room.id, client.name],
      );
      room.closedAt = new Date().toISOString();
      room.closedBy = client.name;
      return broadcast(room, { type: 'room', room: meta(room) });
    }
    case 'reopen': {
      if (client.kind !== 'staff') return fail(client, 'Only the instructor can do that.');
      if (room.interactionId) return fail(client, 'This room is saved with an interaction and stays read-only.');
      await getPool().query("UPDATE core.code_rooms SET closed_at = NULL, closed_by_name = NULL, version = version + 1, updated_at = now() WHERE id = $1", [room.id]);
      room.closedAt = null;
      room.closedBy = null;
      return broadcast(room, { type: 'room', room: meta(room) });
    }
  }
}

// ------------------------------------------------------------------ saving and syncing

/** Saves the room's code if it changed: one UPDATE, only if the database still has what we last saved. */
async function flush(room: Room) {
  if (!room.dirty || room.busy) return;
  room.busy = true;
  room.lastFlush = Date.now();
  const { id, code, version, updatedBy } = room.pad;
  try {
    const res = await getPool().query(
      `WITH p AS (UPDATE core.code_room_problems SET code = $3, version = $4, updated_at = now(), updated_by_name = $5
                  WHERE id = $1 AND room_id = $2 AND version = $6 RETURNING room_id)
       UPDATE core.code_rooms r SET version = r.version + 1, updated_at = now() FROM p WHERE r.id = p.room_id RETURNING r.version`,
      [id, room.id, code, version, updatedBy, room.saved.version],
    );
    if (res.rowCount) {
      room.saved = { code, version };
      if (room.pad.version === version) room.dirty = false;
    } else {
      await reconcile(room); // someone saved over the older HTTP route meanwhile
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'room.flush_failed', room: room.id, error: (err as Error).message }));
  } finally {
    room.busy = false;
  }
}

/** The database has a different version than we last saved: merge it in and tell the room. */
async function reconcile(room: Room) {
  const r = await readRoom(room.id);
  if (!r) return;
  room.closedAt = r.closed_at?.toISOString() ?? null;
  room.closedBy = r.closed_by_name;
  room.interactionId = r.interaction_id;
  const merged = merge3(room.saved.code, room.pad.code, r.code);
  room.saved = { code: r.code, version: r.version };
  room.pad = {
    ...room.pad,
    language: r.language,
    code: merged,
    version: Math.max(room.pad.version, r.version) + (merged === r.code ? 0 : 1),
    updatedBy: merged === r.code ? r.updated_by_name : room.pad.updatedBy,
    updatedAt: new Date().toISOString(),
  };
  if (merged === r.code && room.pad.version === r.version) room.dirty = false;
  else room.dirty = true;
  broadcast(room, { type: 'code', problem: room.pad, origin: null });
  broadcast(room, { type: 'room', room: meta(room) });
}

/** Picks up changes made outside the room (ended by saving the interaction, older clients). */
async function sync(room: Room) {
  if (room.busy) return;
  room.busy = true;
  room.lastSync = Date.now();
  try {
    const { rows } = await getPool().query<{ closed_at: Date | null; closed_by_name: string | null; interaction_id: string | null; language: string; version: number }>(
      `SELECT r.closed_at, r.closed_by_name, r.interaction_id, p.language, p.version
       FROM core.code_rooms r JOIN core.code_room_problems p ON p.room_id = r.id WHERE r.id = $1 AND p.id = $2`,
      [room.id, room.pad.id],
    );
    const r = rows[0];
    if (!r) return;
    if (r.version !== room.saved.version) {
      room.busy = false;
      await reconcile(room);
      return;
    }
    const closedAt = r.closed_at?.toISOString() ?? null;
    if (closedAt !== room.closedAt || r.interaction_id !== room.interactionId || r.language !== room.pad.language) {
      room.closedAt = closedAt;
      room.closedBy = r.closed_by_name;
      room.interactionId = r.interaction_id;
      room.pad = { ...room.pad, language: r.language };
      broadcast(room, { type: 'room', room: meta(room) });
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'room.sync_failed', room: room.id, error: (err as Error).message }));
  } finally {
    room.busy = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Saves, syncs and forgets idle rooms, once a second. */
export function startRoomLoop() {
  timer ??= setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.dirty && now - room.lastFlush >= FLUSH_MS) void flush(room);
      else if (room.clients.size && now - room.lastSync >= SYNC_MS) void sync(room);
      else if (!room.clients.size && !room.dirty && room.idleSince && now - room.idleSince >= EVICT_MS) rooms.delete(room.id);
    }
  }, 1_000);
  timer.unref?.();
}

/** Saves every changed room (shutting down). */
export async function flushAll() {
  await Promise.all([...rooms.values()].map((room) => flush(room)));
}

export function roomStats() {
  let clients = 0;
  for (const room of rooms.values()) clients += room.clients.size;
  return { rooms: rooms.size, clients };
}
