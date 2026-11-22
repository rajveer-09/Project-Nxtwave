/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { SignJWT } from "jose";
import { roomAccess, roomHead, roomsAvailable } from "@nxtone/interactions-ui/room/data";
import { clientIp } from "@/common/auth/request";
import { getOptionalSessionUser } from "@/common/auth/session";
import { rateLimit } from "@/common/lib/rate-limit";

/**
 * A ticket to a code room's live socket on the interactions service (modules/interactions/backend/
 * src/rooms). GET → { url, ticket } after the same access check as the room itself, or
 * { url: null } when live sockets aren't on here (the room then syncs by polling /api/rooms/[id]).
 * The ticket is good for two minutes and one room, and is read-only while viewing as someone.
 *
 * Live sockets are on when switched on (CODE_ROOM_SOCKETS=on, or SOCKETS_ON_BY_DEFAULT; "off" always
 * wins) and the interactions service is reachable from browsers: an https origin (or localhost in
 * development).
 */

/** On since the 150-room test on the live instance passed (22 Nov 2026: 300 sockets, median 56 ms, peak 86 MB). */
const SOCKETS_ON_BY_DEFAULT = true;

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

function socketUrl(): string | null {
  const flag = process.env.CODE_ROOM_SOCKETS;
  if (flag === "off" || (flag !== "on" && !SOCKETS_ON_BY_DEFAULT)) return null;
  const origin = process.env.INTERACTIONS_API_ORIGIN;
  if (!origin || !process.env.INTERACTIONS_JWT_SECRET) return null;
  try {
    const url = new URL("/rooms/socket", origin);
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1") && process.env.NODE_ENV !== "production") url.protocol = "ws:";
    else return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/ticket">) {
  const { id } = await ctx.params;
  if (rateLimit(`room:ticket:${id}:${clientIp(request.headers) ?? "local"}`, 30, 60_000)) {
    return json({ error: "Too many reconnects. Wait a moment." }, 429);
  }
  if (!roomsAvailable()) return json({ url: null });
  const head = await roomHead(id);
  if (!head) return json({ error: "This room doesn't exist." }, 404);
  const access = await roomAccess(head.niatId);
  if (!access.ok) return json({ error: "You can't open this room." }, access.reason === "signed-out" ? 401 : 403);
  const url = socketUrl();
  if (!url) return json({ url: null });

  const readOnly = access.viewer.kind === "staff" && !!(await getOptionalSessionUser())?.viewedBy;
  const ticket = await new SignJWT({ name: access.viewer.name, kind: access.viewer.kind, ro: readOnly })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(id)
    .setIssuer("student-hub-web")
    .setAudience("code-room")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(process.env.INTERACTIONS_JWT_SECRET!));
  return json({ url, ticket, readOnly });
}
