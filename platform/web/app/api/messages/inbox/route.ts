/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { inbox } from "@/modules/messages/data";

/** The signed-in person's messages. Polled by the bell and banner; fetching counts as delivery. */
export async function GET() {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const messages = await inbox(user);
  return Response.json({ messages, unread: messages.filter((m) => !m.readAt).length }, { headers: { "cache-control": "private, no-store" } });
}
