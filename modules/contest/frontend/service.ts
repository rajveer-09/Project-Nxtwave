/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { ServiceConfig } from "@/common/services/forward";
import { contestSample } from "./sample-service";

/** NxtRank (contest tracker), reached through /api/contest/*. */
export const CONTEST_SERVICE: ServiceConfig = {
  name: "contests",
  audience: "contest-api",
  originEnv: "CONTEST_API_ORIGIN",
  secretEnv: "CONTEST_JWT_SECRET",
  upstreamPrefix: "/api",
  sample: contestSample,
  // Everyone else is read-only here (staff without a NxtRank login are viewers there, and a viewer
  // may still queue a scan). The contest service lets any admin request a scan; in NxtOne only the
  // super admin rescans (the worker runs on one laptop and talks to LeetCode, so scans are deliberate).
  guard: (method, path, user) => {
    if (method === "GET" || method === "HEAD") return null;
    if (path.length === 2 && path[0] === "admin" && path[1] === "scans") return user.role === "owner" ? null : "Only the super admin can rescan a contest.";
    return user.role === "owner" || user.role === "admin" ? null : "Only admins can change contest data.";
  },
};
