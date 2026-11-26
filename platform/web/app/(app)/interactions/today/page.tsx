import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { StatusPill } from "@/common/components/chips";
import { FromToFields } from "@/common/components/date-range";
import { EmptyState } from "@/common/components/empty-state";
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
import { InteractionInspect } from "@/modules/students/components/interaction-inspect";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { filterLog } from "@nxtone/interactions-ui/lib/log-filter";
import { coveredLabel, isSupport, STATUS_LABEL } from "@nxtone/interactions-ui/lib/types";

export const metadata = { title: "Today's interactions" };

const PAGE = 100;
const field =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const th = "border-b border-border px-3 py-2.5 text-left font-semibold whitespace-nowrap";
const td = "border-b border-muted px-3 py-2.5 align-top";

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

  const scope = studentScope(user);
  const all =
    scope?.coach !== undefined
      ? await listInteractions({ niatIds: (await getRoster()).filter((s) => inScope(scope, s)).map((s) => s.niatId) })
      : await listInteractions({ instructor: scope?.instructor });
  const rows = filterLog(all, { from: range.from, to: range.to, q });

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const support = rows.filter(isSupport).length;

  const isToday = range.from === today && range.to === today;
  const dates = range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`;
  const exportHref = withParams("/api/logs/interactions/export", {}, { from: range.from, to: range.to, q: q.trim() || null });

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
        {!isToday ? (
          <Link href="/interactions/today" className="flex h-10 items-center px-2 text-sm font-semibold text-primary hover:text-accent-strong">
            Back to today
          </Link>
        ) : null}
      </LiveForm>

      <section aria-label="Interactions" className="overflow-hidden rounded-xl border border-border bg-card">
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[13px]">
              <caption className="sr-only">Interactions {dates}: student, POC, who took it, topics, outcome, rating and remarks</caption>
              <thead className="bg-surface-subtle text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className={`${th} pl-5`}>Student</th>
                  <th scope="col" className={th}>POC (assigned instructor)</th>
                  <th scope="col" className={th}>Taken by</th>
                  <th scope="col" className={th}>Topics covered</th>
                  <th scope="col" className={th}>Outcome</th>
                  <th scope="col" className={th}>Rating</th>
                  <th scope="col" className={th}>Remarks</th>
                  <th scope="col" className={th}>Date</th>
                  <th scope="col" className={`${th} pr-5`}>
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <tr key={it.id}>
                    <td className={`${td} pl-5`}>
                      <div className="font-semibold">{it.studentName}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {it.niatId} · round {it.round}
                      </div>
                    </td>
                    <td className={td}>{it.pocAtTime || "—"}</td>
                    <td className={td}>
                      {it.takenBy}
                      {isSupport(it) ? <div className="mt-0.5 w-fit rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning">support</div> : null}
                    </td>
                    <td className={`${td} text-sidebar-foreground`}>
                      L{it.level} · {coveredLabel(it.topics, it.subtopics)}
                    </td>
                    <td className={td}>
                      <StatusPill tone={it.status === "Cleared" ? "accent" : it.status === "Need to Revisit" ? "warning" : "neutral"}>{STATUS_LABEL[it.status]}</StatusPill>
                    </td>
                    <td className={`${td} font-semibold whitespace-nowrap tabular`}>{it.rating} / 5</td>
                    <td className={`${td} text-sidebar-foreground`}>
                      <p className="line-clamp-2 max-w-44" title={it.remarks}>
                        {it.remarks || "—"}
                      </p>
                    </td>
                    <td className={`${td} whitespace-nowrap text-sidebar-foreground`}>{formatDate(it.date)}</td>
                    <td className={`${td} pr-5 text-right`}>
                      <InteractionInspect niatId={it.niatId} interactionId={it.id} studentName={it.studentName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title={`No interactions for ${dates}`}
              description={q.trim() ? "Nothing matches the search. Clear it or pick other dates." : "Pick From and To above to look at other days."}
            />
          </div>
        )}
      </section>

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
