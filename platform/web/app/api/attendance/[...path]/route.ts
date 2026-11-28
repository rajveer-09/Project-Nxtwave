/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { expire, TAGS } from "@/common/data/cache";
import { forwardToService } from "@/common/services/forward";
import { ATTENDANCE_SERVICE } from "@nxtone/attendance-ui/service";

/** Same-origin proxy to the attendance service (ARCHITECTURE.md §5.2). */
async function handle(request: Request, ctx: RouteContext<"/api/attendance/[...path]">) {
  const { path } = await ctx.params;
  const response = await forwardToService(request, ATTENDANCE_SERVICE, path);
  // A student added, edited, dropped or deleted, or an internship changed (DSA attendance › Students):
  // the hub's cached roster, Home and that student's page show it too.
  if (response.ok && request.method !== "GET" && request.method !== "HEAD" && path[0] === "admin" && (path[1] === "students" || path[1] === "internships")) {
    const id = path[1] === "students" && path[2] && path[2] !== "bulk-delete" ? path[2] : null;
    expire(TAGS.roster, TAGS.home, ...(id ? [TAGS.student(decodeURIComponent(id))] : []));
  }
  return response;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
