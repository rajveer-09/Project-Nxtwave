/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { Pool } from "pg";
import type { Db } from "@/common/auth/core/db";
import type { SessionUser } from "@/common/auth/roles";
import { getDb } from "@/common/db/pool";

/**
 * Runs `work` in one transaction that tells the database who is making the change, so the
 * triggers on core.student_assignments, core.students, core.staff and core.staff_roles write
 * core.change_log rows with this person and source (db/core/migrations/20261118000001).
 * Everything inside either all happens or not at all.
 */
export type ChangeSource = "ui" | "excel";

export async function withChange<T>(user: SessionUser, source: ChangeSource, detail: string | null, work: (db: Db) => Promise<T>): Promise<T> {
  const client = await (getDb() as unknown as Pool).connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT set_config('app.source', $1, true), set_config('app.source_detail', $2, true),
              set_config('app.actor_staff_id', $3, true), set_config('app.actor_name', $4, true),
              set_config('app.actor_email', $5, true), set_config('app.actor_role', $6, true)`,
      [source, detail ?? "", /^\d+$/.test(user.id) ? user.id : "", user.name, user.email, user.role],
    );
    const result = await work(client as unknown as Db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
