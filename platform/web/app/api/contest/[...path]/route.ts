/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { forwardToService } from "@/common/services/forward";
import { CONTEST_SERVICE } from "@nxtone/contest-ui/service";

/** Same-origin proxy to the contest service (ARCHITECTURE.md §5.2). */
async function handle(request: Request, ctx: RouteContext<"/api/contest/[...path]">) {
  const { path } = await ctx.params;
  return forwardToService(request, CONTEST_SERVICE, path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
