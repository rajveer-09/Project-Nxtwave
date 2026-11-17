/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use server";

import { z } from "zod";
import { ROLES } from "@/common/auth/roles";
import { getSessionUser } from "@/common/auth/session";
import { PRIORITIES } from "./audience";
import { markRead, sendMessage } from "./data";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const sendSchema = z.object({
  audience: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("roles"), roles: z.array(z.enum(ROLES)).min(1, "Pick at least one role"), college: z.string().max(20).nullable(), hall: z.string().max(20).nullable() }),
    z.object({ mode: z.literal("people"), ids: z.array(z.string().max(20)).min(1, "Pick at least one person").max(500) }),
  ]),
  subject: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(PRIORITIES),
  requireAck: z.boolean(),
  alsoEmail: z.boolean(),
});

export async function sendMessageAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the recipients, subject and message." };
  const result = await sendMessage(user, parsed.data);
  if (!result.ok) return result;
  const n = result.message.recipients.length;
  return { ok: true, message: `Sent to ${n} ${n === 1 ? "person" : "people"}.` };
}

export async function markReadAction(id: string, acknowledge = false): Promise<ActionResult> {
  const user = await getSessionUser();
  const result = await markRead(user, String(id), !!acknowledge);
  return result.ok ? { ok: true } : result;
}
