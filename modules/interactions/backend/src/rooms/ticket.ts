/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { jwtVerify } from 'jose';
import { identityKey } from '../auth.ts';

/*
 * The browser connects to a room's socket with a ticket the web app signed after checking the person
 * may open that room (platform/web/app/api/rooms/[id]/ticket). It's good for two minutes, for one
 * room, and says who is connecting and whether they may only watch ("view as" is read-only).
 */

export const TICKET_AUDIENCE = 'code-room';
const ISSUER = 'student-hub-web';

export type Ticket = { roomId: string; name: string; kind: 'staff' | 'student'; readOnly: boolean };

/** The ticket's contents, or null if it isn't a valid, current ticket for a room. */
export async function readTicket(token: string | null): Promise<Ticket | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, identityKey(), { issuer: ISSUER, audience: TICKET_AUDIENCE, algorithms: ['HS256'], clockTolerance: 5 });
    const roomId = payload.sub;
    const name = payload.name;
    const kind = payload.kind;
    if (typeof roomId !== 'string' || !/^[A-Za-z0-9]{12}$/.test(roomId)) return null;
    if (typeof name !== 'string' || !name.trim() || (kind !== 'staff' && kind !== 'student')) return null;
    return { roomId, name: name.slice(0, 200), kind, readOnly: payload.ro === true };
  } catch {
    return null;
  }
}
