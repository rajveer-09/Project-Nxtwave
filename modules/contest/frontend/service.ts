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
  // The contest service lets any admin request a scan; in NxtOne only the super admin rescans
  // (the worker runs on one laptop and talks to LeetCode, so scans are kept deliberate).
  guard: (method, path, user) =>
    method === "POST" && path.length === 2 && path[0] === "admin" && path[1] === "scans" && user.role !== "owner" ? "Only the super admin can rescan a contest." : null,
};
