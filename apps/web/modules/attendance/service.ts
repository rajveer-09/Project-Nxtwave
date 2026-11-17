/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import { authMode } from "@/common/auth/config";
import type { ServiceConfig } from "@/common/services/forward";
import { attendanceDb } from "./db-service";
import { attendanceSample } from "./sample-service";

/** The Go attendance API (services/attendance-api), reached through /api/attendance/*. */
export const ATTENDANCE_SERVICE: ServiceConfig = {
  name: "attendance",
  audience: "attendance-api",
  originEnv: "ATTENDANCE_API_ORIGIN",
  secretEnv: "ATTENDANCE_JWT_SECRET",
  upstreamPrefix: "/api",
  // Without the Go service: read the attendance schema when there's a database (real data,
  // read-only; saving needs the service; allowed in production), otherwise the development sample.
  fallback: () => (authMode() === "database" ? attendanceDb : null),
  sample: attendanceSample,
};
