/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { ServiceConfig } from "@/common/services/forward";

/**
 * The interactions service (modules/interactions/backend), reached through /api/logs/*:
 * /api/logs/interactions → {origin}/api/interactions, /api/logs/students/:id → {origin}/api/students/:id, …
 * No development sample: until INTERACTIONS_API_ORIGIN is set the proxy answers 503 and the
 * screens keep using modules/interactions/data.ts.
 */
export const INTERACTIONS_SERVICE: ServiceConfig = {
  name: "interactions",
  audience: "interactions-api",
  originEnv: "INTERACTIONS_API_ORIGIN",
  secretEnv: "INTERACTIONS_JWT_SECRET",
  upstreamPrefix: "/api",
};
