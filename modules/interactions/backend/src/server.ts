/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { flushAll } from './rooms/hub.ts';
import { attachRoomSockets } from './rooms/socket.ts';
import { createApp } from './app.ts';
import { loadIdentityKey } from './auth.ts';
import { closePool, getPool } from './db/pool.ts';
import { migrate } from './migrate.ts';

async function main() {
  loadIdentityKey();
  getPool();
  if (process.env.MIGRATE_ON_START === 'true') {
    await migrate();
    console.log('schema applied');
  }

  const port = Number(process.env.PORT ?? 8090);
  const hostname = process.env.HOST ?? '0.0.0.0';
  const server = serve({ fetch: createApp().fetch, port, hostname }, () => {
    console.log(`interactions-api listening on ${hostname}:${port}`);
  });
  // Live code rooms (WebSockets on the same port).
  attachRoomSockets(server as Server);

  const stop = () => {
    // Save rooms first, so nothing typed in the last seconds is lost.
    void flushAll().finally(() =>
      server.close(() => {
        void closePool().finally(() => process.exit(0));
      }),
    );
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
