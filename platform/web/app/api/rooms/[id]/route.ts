/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { applyOp, loadRoom, roomAccess, roomHead, roomsAvailable } from "@nxtone/interactions-ui/room/data";
import { MAX_CODE, roomOp } from "@nxtone/interactions-ui/room/lib/types";
import { clientIp } from "@/common/auth/request";
import { rateLimit } from "@/common/lib/rate-limit";

/**
 * A code room's live channel. GET ?v=<version>: 204 while nothing changed, else the whole room.
 * POST: one change (code edit, language, end or reopen the room). Staff or the room's student only.
 *
 * Flood guard, checked before any database work: per room and client address, at most
 * POLLS_PER_10S reads and SAVES_PER_10S changes every 10 s (the editor polls every 0.7 s and saves
 * at most a few times a second), and no change body bigger than one full pad. Over that: 429/413.
 */

const POLLS_PER_10S = 60;
const SAVES_PER_10S = 40;
/** A pad's code (up to 4 bytes a character as UTF-8, more once JSON-escaped) plus the op's fields. */
const MAX_BODY_BYTES = MAX_CODE * 6 + 1024;

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

/** The 429 to send if this client has used up its requests for the room, else null. */
async function limited(request: Request, ctx: RouteContext<"/api/rooms/[id]">, kind: "read" | "write") {
  const { id } = await ctx.params;
  const wait = rateLimit(`room:${kind}:${id}:${clientIp(request.headers) ?? "local"}`, kind === "read" ? POLLS_PER_10S : SAVES_PER_10S, 10_000);
  if (!wait) return null;
  return Response.json(
    { error: "Too many changes at once. Slow down for a moment." },
    { status: 429, headers: { ...noStore, "Retry-After": String(wait) } },
  );
}

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
  const tooMany = await limited(request, ctx, "read");
  if (tooMany) return tooMany;
  const checked = await check(ctx);
  if ("error" in checked) return checked.error;
  if (Number(new URL(request.url).searchParams.get("v")) === checked.head.version) return new Response(null, { status: 204, headers: noStore });
  const room = await loadRoom(checked.id);
  if (!room) return json({ error: "This room doesn't exist." }, 404);
  return json({ room, viewer: checked.viewer });
}

export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]">) {
  const tooMany = await limited(request, ctx, "write");
  if (tooMany) return tooMany;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json({ error: "That's more code than a room holds." }, 413);
  }
  const checked = await check(ctx);
  if ("error" in checked) return checked.error;
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return json({ error: "That's more code than a room holds." }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const parsed = roomOp.safeParse(payload);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "That change isn't valid." }, 400);
  const room = await loadRoom(checked.id);
  if (!room) return json({ error: "This room doesn't exist." }, 404);
  const result = await applyOp(room, checked.viewer, parsed.data);
  if (!result.ok) return json({ error: result.error, conflict: result.conflict ?? null }, result.status);
  return json(result);
}
