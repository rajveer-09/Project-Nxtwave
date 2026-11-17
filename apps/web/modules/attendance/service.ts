/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { ServiceConfig } from "@/common/services/forward";
import { attendanceSample } from "./sample-service";

/** The Go attendance API (services/attendance-api), reached through /api/attendance/*. */
export const ATTENDANCE_SERVICE: ServiceConfig = {
  name: "attendance",
  audience: "attendance-api",
  originEnv: "ATTENDANCE_API_ORIGIN",
  secretEnv: "ATTENDANCE_JWT_SECRET",
  upstreamPrefix: "/api",
  sample: attendanceSample,
};
