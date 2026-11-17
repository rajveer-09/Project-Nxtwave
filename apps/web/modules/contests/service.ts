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
};
