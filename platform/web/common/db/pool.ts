/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { Pool } from "pg";
import type { Db } from "@/common/auth/core/db";

/**
 * Connection pool for the web app's Postgres role (web_svc). Its search_path is
 * `logs, core, extensions` (platform/db/setup/service_roles.sql); queries still schema-qualify
 * core tables so they also work from an owner connection.
 */
const globalForPool = globalThis as unknown as { __webPool?: Pool };

export function getDb(): Db {
  const url = process.env.WEB_DATABASE_URL;
  if (!url) throw new Error("WEB_DATABASE_URL is not set.");
  if (!globalForPool.__webPool) {
    globalForPool.__webPool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 5 * 60_000, keepAlive: true });
    // An idle connection the server closes (Neon scales to zero, networks drop) must not crash the process.
    globalForPool.__webPool.on("error", (err) => console.error("[db] idle connection closed:", err.message));
  }
  return globalForPool.__webPool as unknown as Db;
}
