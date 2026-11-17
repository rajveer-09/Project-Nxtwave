/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { randomUUID } from "node:crypto";
import { isAdminRole, type Role, type SessionUser } from "@/common/auth/roles";
import { STAFF } from "@/common/sample-data/staff";
import { describeAudience, resolveAudience, type Audience, type DirectoryEntry, type Priority } from "./audience";

/**
 * Messages (ARCHITECTURE §4.6). In memory for development; with the database this
 * is core.messages + core.message_recipients. "Live" updates use polling now;
 * a realtime channel (Ably/Pusher) replaces the polling interval later.
 *
 * Sample data matches people by staff id, falling back to the session user's name
 * for the development sign-in users.
 */

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

export function directory(): DirectoryEntry[] {
  return STAFF.map(({ id, name, role, active, colleges, halls }) => ({ id, name, role, active, colleges, halls }));
}

/** The directory entry for the signed-in person. */
function meIn(user: SessionUser) {
  return STAFF.find((s) => s.id === user.id) ?? STAFF.find((s) => s.name === user.name) ?? null;
}

const g = globalThis as unknown as { __messageStore?: Message[] };
function seed(): Message[] {
  const mk = (subject: string, body: string, priority: Priority, audience: Audience, createdAt: string, readers: string[], ackers: string[], requireAck = false): Message => {
    const sender = STAFF[0];
    const recipients = resolveAudience(audience, directory(), sender.id).map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      deliveredAt: createdAt,
      readAt: readers.includes(r.name) ? createdAt : null,
      ackAt: ackers.includes(r.name) ? createdAt : null,
    }));
    return { id: randomUUID().slice(0, 8), fromId: sender.id, fromName: sender.name, subject, body, priority, requireAck, alsoEmail: false, audienceLabel: describeAudience(audience, directory()), createdAt, recipients };
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

type Fail = { ok: false; error: string };

export type SendInput = { audience: Audience; subject: string; body: string; priority: Priority; requireAck: boolean; alsoEmail: boolean };

export async function sendMessage(user: SessionUser, input: SendInput): Promise<{ ok: true; message: Message } | Fail> {
  if (!isAdminRole(user.role)) return { ok: false, error: "Only owners and admins send messages." };
  if (!input.subject.trim() || !input.body.trim()) return { ok: false, error: "Add a subject and a message." };
  const sender = meIn(user);
  const recipients = resolveAudience(input.audience, directory(), sender?.id ?? user.id);
  if (!recipients.length) return { ok: false, error: "Nobody matches these recipients." };
  const message: Message = {
    id: randomUUID().slice(0, 8),
    fromId: sender?.id ?? user.id,
    fromName: user.name,
    subject: input.subject.trim(),
    body: input.body.trim(),
    priority: input.priority,
    requireAck: input.requireAck,
    alsoEmail: input.alsoEmail,
    audienceLabel: describeAudience(input.audience, directory()),
    createdAt: new Date().toISOString(),
    recipients: recipients.map((r) => ({ id: r.id, name: r.name, role: r.role, deliveredAt: null, readAt: null, ackAt: null })),
  };
  store().unshift(message);
  return { ok: true, message };
}

export type InboxItem = Omit<Message, "recipients"> & { readAt: string | null; ackAt: string | null };

/** The signed-in person's messages; fetching them counts as delivery. */
export async function inbox(user: SessionUser): Promise<InboxItem[]> {
  const me = meIn(user);
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
  const me = meIn(user);
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

export async function sentMessages(user: SessionUser): Promise<SentItem[] | null> {
  if (!isAdminRole(user.role)) return null;
  return store().map((m) => ({
    ...m,
    total: m.recipients.length,
    delivered: m.recipients.filter((r) => r.deliveredAt).length,
    read: m.recipients.filter((r) => r.readAt).length,
    acked: m.recipients.filter((r) => r.ackAt).length,
  }));
}
