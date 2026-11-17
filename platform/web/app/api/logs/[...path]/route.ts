/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { forwardToService } from "@/common/services/forward";
import { INTERACTIONS_SERVICE } from "@nxtone/interactions-ui/service";

/** Same-origin proxy to the interactions service. /api/logs/interactions/export stays in the web app. */
async function handle(request: Request, ctx: RouteContext<"/api/logs/[...path]">) {
  const { path } = await ctx.params;
  return forwardToService(request, INTERACTIONS_SERVICE, path);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
