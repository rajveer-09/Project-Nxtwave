/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/common/data/cache";
import { randomUUID } from "node:crypto";
import { authMode } from "@/common/auth/config";
import { platformRole } from "@/common/auth/core/sessions";
import { isAdminRole, visibleRoles, type Role, type SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";
import { STAFF } from "@/common/sample-data/staff";
import { describeAudience, resolveAudience, type Audience, type DirectoryEntry, type Priority } from "./audience";

/**
 * Messages (ARCHITECTURE §4.6). With the database: core.messages + core.message_recipients,
 * and the directory is core.staff (platform role, plus the colleges and halls of each
 * instructor's current students). Without it, an in-memory sample for development.
 * "Live" updates use polling; a realtime channel (Ably/Pusher) can replace the interval later.
 */

const fromDb = () => authMode() === "database";

export type Recipient = { id: string; name: string; role: Role; deliveredAt: string | null; readAt: string | null; ackAt: string | null };
export type Message = {
  id: string;
  fromId: string;
  fromName: string;
  subject: string;
  body: string;
  priority: Priority;
  requireAck: boolean;
  alsoEmail: boolean;
  audienceLabel: string;
  createdAt: string;
  recipients: Recipient[];
};

export async function directory(): Promise<DirectoryEntry[]> {
  if (!fromDb()) return STAFF.map(({ id, name, role, active, colleges, halls }) => ({ id, name, role, active, colleges, halls }));
  return cachedDirectory();
}

async function cachedDirectory(): Promise<DirectoryEntry[]> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 900 });
  cacheTag(TAGS.staff, TAGS.roster);
  const { rows } = await getDb().query<{ id: string; name: string; active: boolean; roles: { module: string; role: string }[]; colleges: string[]; halls: string[] }>(
    `SELECT s.id::text, s.name, s.active AND s.left_on IS NULL AS active,
            COALESCE((SELECT json_agg(json_build_object('module', r.module, 'role', r.role)) FROM core.staff_roles r WHERE r.staff_id = s.id), '[]') AS roles,
            COALESCE(ARRAY(SELECT DISTINCT cs.college FROM core.student_assignments a JOIN core.students cs ON cs.niat_id = a.niat_id
                           WHERE a.staff_id = s.id AND a.to_date IS NULL ORDER BY 1), '{}') AS colleges,
            COALESCE(ARRAY(SELECT DISTINCT cs.hall FROM core.student_assignments a JOIN core.students cs ON cs.niat_id = a.niat_id
                           WHERE a.staff_id = s.id AND a.to_date IS NULL AND cs.hall IS NOT NULL ORDER BY 1), '{}') AS halls
     FROM core.staff s WHERE s.deleted_at IS NULL ORDER BY s.name`,
  );
  return rows.flatMap((r) => {
    const role = platformRole(r.roles);
    return role ? [{ id: r.id, name: r.name, role, active: r.active, colleges: r.colleges, halls: r.halls }] : [];
  });
}

/** The directory entry for the signed-in person. */
async function meIn(user: SessionUser) {
  const dir = await directory();
  return dir.find((s) => s.id === user.id) ?? (fromDb() ? null : (dir.find((s) => s.name === user.name) ?? null));
}

// ---------------------------------------------------------------- sample store

const g = globalThis as unknown as { __messageStore?: Message[] };
function seed(): Message[] {
  const dir = STAFF.map(({ id, name, role, active, colleges, halls }) => ({ id, name, role, active, colleges, halls }));
  const mk = (subject: string, body: string, priority: Priority, audience: Audience, createdAt: string, readers: string[], ackers: string[], requireAck = false): Message => {
    const sender = STAFF[0];
    const recipients = resolveAudience(audience, dir, sender.id).map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      deliveredAt: createdAt,
      readAt: readers.includes(r.name) ? createdAt : null,
      ackAt: ackers.includes(r.name) ? createdAt : null,
    }));
    return { id: randomUUID().slice(0, 8), fromId: sender.id, fromName: sender.name, subject, body, priority, requireAck, alsoEmail: false, audienceLabel: describeAudience(audience, dir), createdAt, recipients };
  };
  return [
    mk(
      "Weekly Test 12 marks due today, 6 pm",
      "Please finish entering Weekly Test 12 marks and improvement areas for your students by 6 pm today. Mark absent students as absent instead of leaving the row blank.",
      "important",
      { mode: "roles", roles: ["instructor", "senior_instructor"], college: null, hall: null },
      "2026-11-17T09:30:00+05:30",
      ["Neha P.", "Suresh M."],
      ["Neha P."],
      true,
    ),
    mk(
      "Hall 3 and Hall 11 attendance not marked",
      "Attendance for Hall 3 and Hall 11 is still open for today. Please mark it before 11:00.",
      "urgent",
      { mode: "roles", roles: ["admin"], college: null, hall: null },
      "2026-11-16T10:05:00+05:30",
      ["Ravi V."],
      [],
    ),
    mk(
      "New off-roadmap review process",
      "If you ask a question that isn't in the roadmap, add it under 'Asked a question that isn't listed?' in the interaction form. Admins review these weekly.",
      "normal",
      { mode: "roles", roles: ["instructor", "senior_instructor"], college: null, hall: null },
      "2026-11-12T17:40:00+05:30",
      ["Karthik S.", "Neha P.", "Suresh M.", "Divya R.", "Anil T."],
      [],
    ),
  ];
}
const store = () => (g.__messageStore ??= seed());

// ---------------------------------------------------------------- send / read

type Fail = { ok: false; error: string };

export type SendInput = { audience: Audience; subject: string; body: string; priority: Priority; requireAck: boolean; alsoEmail: boolean };

export async function sendMessage(user: SessionUser, input: SendInput): Promise<{ ok: true; message: Message } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only owners and admins send messages." };
  if (!input.subject.trim() || !input.body.trim()) return { ok: false, error: "Add a subject and a message." };
  const allowed = new Set(visibleRoles(user.role));
  const dir = (await directory()).filter((d) => allowed.has(d.role));
  const sender = await meIn(user);
  const recipients = resolveAudience(input.audience, dir, sender?.id ?? user.id);
  if (!recipients.length) return { ok: false, error: "Nobody matches these recipients." };
  const audienceLabel = describeAudience(input.audience, dir);

  if (fromDb()) {
    const { rows } = await getDb().query<{ id: string; created_at: string }>(
      `WITH m AS (
         INSERT INTO core.messages (sender_staff_id, sender_name, subject, body, priority, require_ack, also_email, audience, audience_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at
       ), r AS (
         INSERT INTO core.message_recipients (message_id, staff_id) SELECT m.id, unnest($10::bigint[]) FROM m
       )
       SELECT id::text, created_at FROM m`,
      [
        sender ? Number(sender.id) : null,
        user.name,
        input.subject.trim(),
        input.body.trim(),
        input.priority,
        input.requireAck,
        input.alsoEmail,
        JSON.stringify(input.audience),
        audienceLabel,
        recipients.map((r) => Number(r.id)),
      ],
    );
    return {
      ok: true,
      message: {
        id: rows[0].id,
        fromId: sender?.id ?? user.id,
        fromName: user.name,
        subject: input.subject.trim(),
        body: input.body.trim(),
        priority: input.priority,
        requireAck: input.requireAck,
        alsoEmail: input.alsoEmail,
        audienceLabel,
        createdAt: new Date(rows[0].created_at).toISOString(),
        recipients: recipients.map((r) => ({ id: r.id, name: r.name, role: r.role, deliveredAt: null, readAt: null, ackAt: null })),
      },
    };
  }

  const message: Message = {
    id: randomUUID().slice(0, 8),
    fromId: sender?.id ?? user.id,
    fromName: user.name,
    subject: input.subject.trim(),
    body: input.body.trim(),
    priority: input.priority,
    requireAck: input.requireAck,
    alsoEmail: input.alsoEmail,
    audienceLabel,
    createdAt: new Date().toISOString(),
    recipients: recipients.map((r) => ({ id: r.id, name: r.name, role: r.role, deliveredAt: null, readAt: null, ackAt: null })),
  };
  store().unshift(message);
  return { ok: true, message };
}

export type InboxItem = Omit<Message, "recipients"> & { readAt: string | null; ackAt: string | null };

type MessageRow = {
  id: string;
  from_id: string | null;
  from_name: string;
  subject: string;
  body: string;
  priority: Priority;
  require_ack: boolean;
  also_email: boolean;
  audience_label: string;
  created_at: string;
};
const MESSAGE_COLUMNS = `m.id::text, m.sender_staff_id::text AS from_id, m.sender_name AS from_name, m.subject, m.body, m.priority,
  m.require_ack, m.also_email, m.audience_label, m.created_at`;
const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
const toMessage = (r: MessageRow) => ({
  id: r.id,
  fromId: r.from_id ?? "",
  fromName: r.from_name,
  subject: r.subject,
  body: r.body,
  priority: r.priority,
  requireAck: r.require_ack,
  alsoEmail: r.also_email,
  audienceLabel: r.audience_label,
  createdAt: new Date(r.created_at).toISOString(),
});

/** The signed-in person's messages; fetching them counts as delivery. */
export async function inbox(user: SessionUser): Promise<InboxItem[]> {
  if (fromDb()) {
    if (!/^\d+$/.test(user.id)) return [];
    const db = getDb();
    await db.query("UPDATE core.message_recipients SET delivered_at = now() WHERE staff_id = $1 AND delivered_at IS NULL", [user.id]);
    const { rows } = await db.query<MessageRow & { read_at: string | null; acked_at: string | null }>(
      `SELECT ${MESSAGE_COLUMNS}, r.read_at, r.acked_at
       FROM core.message_recipients r JOIN core.messages m ON m.id = r.message_id
       WHERE r.staff_id = $1 ORDER BY m.created_at DESC LIMIT 200`,
      [user.id],
    );
    return rows.map((r) => ({ ...toMessage(r), readAt: iso(r.read_at), ackAt: iso(r.acked_at) }));
  }
  const me = await meIn(user);
  if (!me) return [];
  const now = new Date().toISOString();
  const out: InboxItem[] = [];
  for (const m of store()) {
    const r = m.recipients.find((x) => x.id === me.id);
    if (!r) continue;
    r.deliveredAt ??= now;
    const { recipients: _omit, ...rest } = m;
    void _omit;
    out.push({ ...rest, readAt: r.readAt, ackAt: r.ackAt });
  }
  return out;
}

export async function markRead(user: SessionUser, id: string, acknowledge: boolean): Promise<{ ok: true } | Fail> {
  if (fromDb()) {
    if (!/^\d+$/.test(id) || !/^\d+$/.test(user.id)) return { ok: false, error: "Message not found." };
    const { rows } = await getDb().query(
      `UPDATE core.message_recipients
       SET delivered_at = COALESCE(delivered_at, now()), read_at = COALESCE(read_at, now()),
           acked_at = CASE WHEN $3 THEN COALESCE(acked_at, now()) ELSE acked_at END
       WHERE message_id = $1 AND staff_id = $2 RETURNING message_id`,
      [id, user.id, acknowledge],
    );
    return rows.length ? { ok: true } : { ok: false, error: "Message not found." };
  }
  const me = await meIn(user);
  const m = store().find((x) => x.id === id);
  const r = m?.recipients.find((x) => x.id === me?.id);
  if (!m || !r) return { ok: false, error: "Message not found." };
  const now = new Date().toISOString();
  r.deliveredAt ??= now;
  r.readAt ??= now;
  if (acknowledge) r.ackAt ??= now;
  return { ok: true };
}

export type SentItem = Omit<Message, "recipients"> & {
  total: number;
  delivered: number;
  read: number;
  acked: number;
  recipients: Recipient[];
};

const summarise = (m: Message): SentItem => ({
  ...m,
  total: m.recipients.length,
  delivered: m.recipients.filter((r) => r.deliveredAt).length,
  read: m.recipients.filter((r) => r.readAt).length,
  acked: m.recipients.filter((r) => r.ackAt).length,
});

export async function sentMessages(user: SessionUser): Promise<SentItem[] | null> {
  if (!isAdminRole(user.role)) return null;
  if (!fromDb()) return store().map(summarise);
  const roles = new Map((await directory()).map((d) => [d.id, d.role]));
  const { rows } = await getDb().query<MessageRow & { recipients: { id: string; name: string; deliveredAt: string | null; readAt: string | null; ackAt: string | null }[] }>(
    `SELECT ${MESSAGE_COLUMNS},
            COALESCE(json_agg(json_build_object('id', r.staff_id::text, 'name', st.name, 'deliveredAt', r.delivered_at,
                                                'readAt', r.read_at, 'ackAt', r.acked_at) ORDER BY st.name)
                     FILTER (WHERE r.staff_id IS NOT NULL), '[]') AS recipients
     FROM core.messages m
     LEFT JOIN core.message_recipients r ON r.message_id = m.id
     LEFT JOIN core.staff st ON st.id = r.staff_id
     GROUP BY m.id ORDER BY m.created_at DESC LIMIT 100`,
  );
  return rows.map((r) =>
    summarise({
      ...toMessage(r),
      recipients: r.recipients.map((x) => ({
        id: x.id,
        name: x.name,
        role: roles.get(x.id) ?? "instructor",
        deliveredAt: iso(x.deliveredAt),
        readAt: iso(x.readAt),
        ackAt: iso(x.ackAt),
      })),
    }),
  );
}
