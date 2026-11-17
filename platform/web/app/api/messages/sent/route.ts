/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { sentMessages } from "@/modules/messages/data";

/** Sent messages with delivery, read and acknowledgement counts (owners and admins). */
export async function GET() {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const sent = await sentMessages(user);
  if (!sent) return Response.json({ error: "Owners and admins only" }, { status: 403 });
  return Response.json({ sent }, { headers: { "cache-control": "private, no-store" } });
}
