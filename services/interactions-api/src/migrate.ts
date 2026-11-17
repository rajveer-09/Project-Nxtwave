/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { closePool, getPool } from './db/pool.ts';

// db/schema.sql is idempotent, so applying it on every start is safe.
const SCHEMA = new URL('../db/schema.sql', import.meta.url);

export async function migrate(): Promise<void> {
  const sql = await readFile(SCHEMA, 'utf8');
  await getPool().query(sql);
}

// `npm run migrate`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  migrate()
    .then(async () => {
      const { rows } = await getPool().query<{ db: string; schema: string }>('SELECT current_database() AS db, current_schema() AS schema');
      console.log(`Schema applied to ${rows[0].db} (${rows[0].schema}).`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(closePool);
}
