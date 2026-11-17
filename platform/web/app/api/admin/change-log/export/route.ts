/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { getOptionalSessionUser } from "@/common/auth/session";
import { isAdminRole } from "@/common/auth/roles";
import { toCsv } from "@/common/lib/csv";
import { todayIst } from "@/common/lib/dates";
import { ENTITIES, listChanges, SOURCES, type ChangeEntry } from "@/modules/admin/change-log-data";

/** CSV of the change log with the page's filters (admins and super admins; same masking as the page). */
export async function GET(request: Request) {
  const user = await getOptionalSessionUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!isAdminRole(user.role)) return Response.json({ error: "Admins only" }, { status: 403 });
  const url = new URL(request.url);
  const get = (k: string) => url.searchParams.get(k) || undefined;
  const date = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const filter = {
    q: get("q")?.slice(0, 100),
    source: (SOURCES as readonly string[]).includes(get("source") ?? "") ? get("source") : undefined,
    entity: (ENTITIES as readonly string[]).includes(get("entity") ?? "") ? get("entity") : undefined,
    from: date(get("from")),
    to: date(get("to")),
  };
  const all: ChangeEntry[] = [];
  for (let page = 1; page <= 200; page++) {
    const { entries, more } = await listChanges(user, { ...filter, page });
    all.push(...entries);
    if (!more) break;
  }
  const csv = toCsv(
    ["When (UTC)", "Change", "For", "NIAT ID", "Before", "After", "Made by", "Their role", "From", "Details"],
    all.map((e) => [
      e.at,
      e.what,
      e.subject?.name ?? "",
      e.subject?.kind === "student" ? e.subject.niatId : "",
      e.before ?? "",
      e.after ?? "",
      e.by,
      e.byRole ?? "",
      e.source,
      e.sourceDetail ?? "",
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nxtone-change-log-${todayIst()}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
