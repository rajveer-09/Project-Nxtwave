/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { isIP } from "node:net";

/**
 * Client IP for rate limiting. Behind Vercel the first X-Forwarded-For entry is
 * the client; anything that isn't a valid IP is ignored.
 */
export function clientIp(headers: Headers): string | null {
  const candidate = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "").split(",")[0].trim();
  return isIP(candidate) ? candidate : null;
}
