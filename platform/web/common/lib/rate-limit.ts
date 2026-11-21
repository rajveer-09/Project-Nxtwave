/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

import "server-only";

/**
 * Fixed-window request limiter kept in memory. Each server instance counts on its own, so it's a
 * brake on bursts from one client (a script, an extension, a stuck loop), not an exact quota.
 */
type Window = { start: number; count: number; ms: number };
const windows = new Map<string, Window>();
let lastSweep = 0;

/** Counts one request for `key`; returns 0 if it's allowed, else the seconds until it would be. */
export function rateLimit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  if (now - lastSweep > 60_000 || windows.size > 20_000) {
    for (const [k, w] of windows) if (now - w.start >= w.ms) windows.delete(k);
    lastSweep = now;
  }
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1, ms: windowMs });
    return 0;
  }
  if (w.count >= limit) return Math.max(1, Math.ceil((w.start + windowMs - now) / 1000));
  w.count++;
  return 0;
}
