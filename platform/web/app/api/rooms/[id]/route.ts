/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { applyOp, loadRoom, roomAccess, roomHead, roomsAvailable } from "@nxtone/interactions-ui/room/data";
import { roomOp } from "@nxtone/interactions-ui/room/lib/types";

/**
 * A code room's live channel. GET ?v=<version>: 204 while nothing changed, else the whole room.
 * POST: one change (code edit, language, end or reopen the room). Staff or the room's student only.
 */

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

/** The room's head and who is asking, or the error response to send. */
async function check(ctx: RouteContext<"/api/rooms/[id]">) {
  if (!roomsAvailable()) return { error: json({ error: "Code rooms need the database." }, 503) } as const;
  const { id } = await ctx.params;
  const head = await roomHead(id);
  if (!head) return { error: json({ error: "This room doesn't exist." }, 404) } as const;
  const access = await roomAccess(head.niatId);
  if (!access.ok) {
    const signedOut = access.reason === "signed-out";
    return { error: json({ error: signedOut ? "Sign in to open this room." : "You can't open this room." }, signedOut ? 401 : 403) } as const;
  }
  return { id, head, viewer: access.viewer } as const;
}

export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  const checked = await check(ctx);
  if ("error" in checked) return checked.error;
  if (Number(new URL(request.url).searchParams.get("v")) === checked.head.version) return new Response(null, { status: 204, headers: noStore });
  const room = await loadRoom(checked.id);
  if (!room) return json({ error: "This room doesn't exist." }, 404);
  return json({ room, viewer: checked.viewer });
}

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  const checked = await check(ctx);
  if ("error" in checked) return checked.error;
  const parsed = roomOp.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "That change isn't valid." }, 400);
  const room = await loadRoom(checked.id);
  if (!room) return json({ error: "This room doesn't exist." }, 404);
  const result = await applyOp(room, checked.viewer, parsed.data);
  if (!result.ok) return json({ error: result.error, conflict: result.conflict ?? null }, result.status);
  return json(result);
}
