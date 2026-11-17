/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

/** Minimal query interface satisfied by both `pg.Pool` and PGlite (used in tests). */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
