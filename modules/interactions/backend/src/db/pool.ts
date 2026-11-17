/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import pg from 'pg';

// DATE -> 'YYYY-MM-DD' string (default would be a JS Date shifted by the server timezone).
pg.types.setTypeParser(1082, (value) => value);
// NUMERIC -> number (rating).
pg.types.setTypeParser(1700, (value) => parseFloat(value));

let pool: pg.Pool | undefined;

/** One pool per process. DATABASE_URL is the interactions_svc role (search_path logs, core, extensions). */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example).');
    pool = new pg.Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 5) });
    // An idle connection the server closes (Neon scales to zero, networks drop) must not crash the service.
    pool.on('error', (err) => console.error('[db] idle connection closed:', err.message));
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
