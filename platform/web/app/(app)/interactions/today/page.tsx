import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { FromToFields } from "@/common/components/date-range";
import { QueryInput } from "@/common/components/query-input";
import { LiveForm } from "@/common/components/live-form";
import { PageHeader } from "@/common/components/page-header";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { inScope, studentScope } from "@/common/auth/student-access";
import { getRoster } from "@/common/data/roster";
import { formatDate, todayIst } from "@/common/lib/dates";
import { parseRange } from "@/common/lib/range";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { InteractionsTable } from "@/modules/students/components/interactions-table";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { filterLog } from "@nxtone/interactions-ui/lib/log-filter";
import { isSupport } from "@nxtone/interactions-ui/lib/types";

export const metadata = { title: "Today's interactions" };

const PAGE = 100;
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Every interaction for a day (today unless From/To say otherwise): who took it, whose student it
 * was (POC at the time), what was covered and how it went. Same people as the Interactions page:
 * instructors their own students, coaches their coached students, admins everyone.
 */
async function TodayContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const user = await requireAccess("/interactions");
  const params = await searchParams;
  const today = todayIst();
  const range = parseRange(params, today, 1);
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  // Person filters arriving from the Interactions page's "See all" (by = who took it, poc = whose student).
  const takenBy = typeof params.by === "string" && params.by ? params.by : null;
  const poc = typeof params.poc === "string" && params.poc ? params.poc : null;

  const scope = studentScope(user);
  const all =
    scope?.coach !== undefined
      ? await listInteractions({ niatIds: (await getRoster()).filter((s) => inScope(scope, s)).map((s) => s.niatId) })
      : await listInteractions({ instructor: scope?.instructor });
  const rows = filterLog(all, { from: range.from, to: range.to, q, takenBy, poc });

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const support = rows.filter(isSupport).length;

  const isToday = range.from === today && range.to === today;
  const dates = range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`;
  const exportHref = withParams("/api/logs/interactions/export", {}, { from: range.from, to: range.to, q: q.trim() || null, by: takenBy, poc });

  return (
    <>
      <PageHeader
        eyebrow="Interactions"
        title={isToday ? "Today's interactions" : "Interactions by date"}
        description={`${dates} · ${rows.length.toLocaleString("en-IN")} record${rows.length === 1 ? "" : "s"}${support ? ` · ${support} taken by a support POC` : ""}. ${
          scope ? "Your students only." : "Every instructor."
        } Pick From and To to see a longer period.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/interactions" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All interactions
            </Link>
            <a href={exportHref} download className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted">
              <Download aria-hidden="true" className="size-4" />
              {isToday ? "Export today (CSV)" : "Export (CSV)"}
            </a>
          </div>
        }
      />

      <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter interactions">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <QueryInput value={q} placeholder="Student, NIAT ID, POC, taken by, topics or remarks" className={`${field} w-full`} />
        </label>
        <FromToFields from={range.from} to={range.to} today={today} />
        {/* Keep the person filters when the dates or search change (the form only sends its own fields). */}
        {takenBy ? <input type="hidden" name="by" value={takenBy} /> : null}
        {poc ? <input type="hidden" name="poc" value={poc} /> : null}
        {!isToday ? (
          <Link href="/interactions/today" className="flex h-10 items-center px-2 text-sm font-semibold text-primary hover:text-accent-strong">
            Back to today
          </Link>
        ) : null}
      </LiveForm>

      {takenBy || poc ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Only:</span>
          {[
            poc ? { label: `${poc}'s students`, drop: { poc: null } } : null,
            takenBy ? { label: `taken by ${takenBy}`, drop: { by: null } } : null,
          ]
            .filter((f) => f !== null)
            .map((f) => (
              <Link
                key={f.label}
                href={withParams("/interactions/today", params, f.drop)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-semibold hover:bg-muted"
                aria-label={`Remove filter: ${f.label}`}
              >
                {f.label}
                <span aria-hidden="true" className="text-muted-foreground">
                  ✕
                </span>
              </Link>
            ))}
        </div>
      ) : null}

      <InteractionsTable
        rows={shown}
        caption={`Interactions ${dates}`}
        empty={{
          title: `No interactions for ${dates}`,
          description: q.trim() ? "Nothing matches the search. Clear it or pick other dates." : "Pick From and To above to look at other days.",
        }}
      />

      {pageCount > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={withParams("/interactions/today", params, { page: page - 1 > 1 ? page - 1 : null })} className="font-semibold text-primary">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {pageCount} · {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length.toLocaleString("en-IN")}
          </span>
          {page < pageCount ? (
            <Link href={withParams("/interactions/today", params, { page: page + 1 })} className="font-semibold text-primary">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}

export default function TodayInteractionsPage({ searchParams }: PageProps<"/interactions/today">) {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-xl" />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}
