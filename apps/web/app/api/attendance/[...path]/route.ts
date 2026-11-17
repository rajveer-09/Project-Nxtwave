/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { forwardToService } from "@/common/services/forward";
import { ATTENDANCE_SERVICE } from "@/modules/attendance/service";

/** Same-origin proxy to the attendance service (ARCHITECTURE.md §5.2). */
async function handle(request: Request, ctx: RouteContext<"/api/attendance/[...path]">) {
  const { path } = await ctx.params;
  return forwardToService(request, ATTENDANCE_SERVICE, path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
