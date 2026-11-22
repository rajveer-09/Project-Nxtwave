/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { handle, hello, joinRoom, leaveRoom, MAX_CLIENTS_PER_ROOM, startRoomLoop, type Client } from './hub.ts';
import { readTicket, type Ticket } from './ticket.ts';

/*
 * WebSocket endpoint for live code rooms: wss://<this service>/rooms/socket?ticket=<signed by the web app>.
 * Without a valid ticket the upgrade is refused. Messages are JSON (see hub.ts). Limits: one message of
 * at most 256 KB, MAX_MESSAGES per WINDOW_MS per connection (typing sends a few a second), and a ping
 * every 25 s that closes connections which stopped answering.
 */

export const ROOM_SOCKET_PATH = '/rooms/socket';
const MAX_MESSAGES = 80;
const WINDOW_MS = 10_000;

function refuse(socket: Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export function attachRoomSockets(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== ROOM_SOCKET_PATH) return refuse(socket, '404 Not Found');
    void readTicket(url.searchParams.get('ticket')).then((ticket) => {
      if (!ticket) return refuse(socket, '401 Unauthorized');
      wss.handleUpgrade(req, socket, head, (ws) => void connected(ws, ticket));
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const c = clientOf.get(ws);
      if (c && !c.alive) {
        ws.terminate();
        continue;
      }
      if (c) c.alive = false;
      ws.ping();
    }
  }, 25_000);
  heartbeat.unref?.();
  server.on('close', () => clearInterval(heartbeat));
  startRoomLoop();
}

const clientOf = new WeakMap<WebSocket, Client>();

async function connected(ws: WebSocket, ticket: Ticket) {
  const client: Client = { id: randomUUID(), socket: ws, name: ticket.name, kind: ticket.kind, readOnly: ticket.readOnly, alive: true, recent: [] };
  clientOf.set(ws, client);
  ws.on('pong', () => (client.alive = true));

  let room: Awaited<ReturnType<typeof joinRoom>>;
  try {
    room = await joinRoom(ticket.roomId, client);
  } catch (err) {
    console.error(JSON.stringify({ event: 'room.join_failed', room: ticket.roomId, error: (err as Error).message }));
    ws.close(1011, 'Could not open the room');
    return;
  }
  if (!room) return ws.close(4404, 'No such room');
  if (room.clients.size > MAX_CLIENTS_PER_ROOM) {
    leaveRoom(room, client);
    return ws.close(4429, 'Room is full');
  }
  const joined = room;
  hello(joined, client);

  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    const now = Date.now();
    client.recent = client.recent.filter((t) => now - t < WINDOW_MS);
    if (client.recent.length >= MAX_MESSAGES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Too many changes at once. Slow down for a moment.', retry: true }));
      return;
    }
    client.recent.push(now);
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }
    handle(joined, client, message).catch((err) => {
      console.error(JSON.stringify({ event: 'room.message_failed', room: joined.id, error: (err as Error).message }));
      ws.send(JSON.stringify({ type: 'error', message: "That change didn't go through. Try again." }));
    });
  });
  ws.on('close', () => leaveRoom(joined, client));
  ws.on('error', () => ws.terminate());
}
