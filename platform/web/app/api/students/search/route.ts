/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { getRoster } from "@/common/data/roster";
import { canAccess } from "@/common/lib/nav";
import { normalizeSearch, searchMatcher } from "@/common/lib/search";

const LIMIT = 8;
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Students matching a name or NIAT ID, for the student box on Log interaction (suggestions while
 * typing). Staff who may log interactions only; just what that page shows for any NIAT ID: name,
 * NIAT ID, college and section. Best matches first: the exact ID, then IDs and names that start with
 * what was typed, then the rest A–Z.
 */
export async function GET(request: Request) {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401, headers: noStore });
  if (!canAccess(user.role, "/log-interaction")) return Response.json({ error: "Forbidden" }, { status: 403, headers: noStore });

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 60);
  const needle = normalizeSearch(q);
  if (!needle) return Response.json({ students: [] }, { headers: noStore });

  const match = searchMatcher(q);
  const rank = (s: { name: string; niatId: string }) => {
    const id = s.niatId.toLowerCase();
    const name = normalizeSearch(s.name);
    if (id === needle.replace(/ /g, "")) return 0;
    if (id.startsWith(needle)) return 1;
    if (name.startsWith(needle)) return 2;
    if (name.split(" ").some((w) => w.startsWith(needle.split(" ")[0]))) return 3;
    return 4;
  };
  const students = (await getRoster())
    .filter((s) => match(s.name, s.niatId))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, LIMIT)
    .map((s) => ({ niatId: s.niatId, name: s.name, college: s.college, section: s.section }));
  return Response.json({ students }, { headers: noStore });
}
