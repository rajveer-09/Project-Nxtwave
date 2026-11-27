/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Dropdown } from "@/common/components/dropdown";
import { EmptyState } from "@/common/components/empty-state";
import { asOptions } from "@/common/lib/options";
import { searchMatcher } from "@/common/lib/search";
import { PageHeader } from "@/common/components/page-header";
import { Button } from "@/common/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/common/ui/sheet";
import { Skeleton } from "@/common/ui/skeleton";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { Analytics, AnalyticsPeriod, AnalyticsQuery, AnalyticsShow, AnalyticsStudent, DayTally, GroupTally, Tally } from "@nxtone/attendance-ui/types";

/*
 * Owner-only attendance analytics (the attendance dashboard's Analytics page, in the Student Hub
 * theme). Every number comes from the service (stats.Analyze); this file only lays them out. Over
 * several days Present / Absent are student-days, shown next to the average per working day.
 */

const NO_HALL = "__none__";
const hallLabel = (h: string) => h || "No hall";
const num = (n: number) => n.toLocaleString("en-IN");
const pct = (p: number | null | undefined) => (p === null || p === undefined ? "–" : `${p.toFixed(2)}%`);
const dec = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: 1 }));
const control =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-auto";

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "lastmonth", label: "Last month" },
  { id: "custom", label: "Custom" },
];

const istTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function periodLabel(a: Analytics) {
  const span = a.from === a.to ? formatDate(a.from) : `${formatDate(a.from)} – ${formatDate(a.to)}`;
  switch (a.period) {
    case "today":
      return `Today · ${span}`;
    case "last7":
      return `Last 7 days · ${span}`;
    case "lastmonth":
      return `Last month · ${monthName.format(new Date(`${a.from}T00:00:00Z`))}`;
    default:
      return span;
  }
}

function scopeLabel(filter: Analytics["filter"]) {
  const parts = [filter.degree || "All degrees", filter.hall === null ? "All halls" : hallLabel(filter.hall)];
  if (filter.section) parts.push(`Section ${filter.section}`);
  return parts.join(" · ");
}

export function AnalyticsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const p = params.get("period");
  const period: AnalyticsPeriod = PERIODS.some((x) => x.id === p) ? (p as AnalyticsPeriod) : "today";
  const degree = params.get("degree") ?? "";
  const hall = params.has("hall") ? (params.get("hall") ?? "") : undefined;
  const section = params.get("section") ?? "";
  // Custom dates in state too, so changing From then To never loses one.
  const [dates, setDates] = useState({ from: params.get("from") ?? "", to: params.get("to") ?? "" });
  const customOk = dates.from !== "" && dates.to !== "" && dates.from <= dates.to;
  const [drill, setDrill] = useState<Drill | null>(null);
  const [exporting, setExporting] = useState(false);

  function setParam(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const query: AnalyticsQuery = { period, degree, hall, section, ...(period === "custom" ? dates : {}) };
  const res = useQuery({
    queryKey: ["attendance", "analytics", query],
    queryFn: () => attendanceApi.analytics(query),
    enabled: period !== "custom" || customOk,
    placeholderData: (prev) => prev,
  });
  const a = res.data;

  async function exportExcel() {
    setExporting(true);
    try {
      const { blob, name } = await attendanceApi.analyticsExcel(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  // Filter choices come from every student; hall and section follow the degree.
  const halls = [...new Set((a?.options.halls ?? []).filter((h) => !degree || h.degree === degree).map((h) => h.value))];
  const sections = [...new Set((a?.options.sections ?? []).filter((s) => !degree || s.degree === degree).map((s) => s.value))].sort();
  const filtered = degree !== "" || hall !== undefined || section !== "" || period !== "today";

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Admin panel"
          title="DSA attendance analytics"
          description="Attendance across degrees and halls, ready to share."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10 px-3.5" onClick={exportExcel} disabled={!a || exporting}>
                <FileSpreadsheet className="size-4" /> {exporting ? "Preparing…" : "Excel"}
              </Button>
              <Button variant="outline" className="h-10 px-3.5" onClick={() => window.print()} disabled={!a}>
                <Printer className="size-4" /> Print
              </Button>
            </div>
          }
        />
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 print:hidden" aria-label="Report filters">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-lg bg-muted p-0.5" role="group" aria-label="Period">
            {PERIODS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={period === x.id}
                onClick={() => setParam({ period: x.id === "today" ? null : x.id, ...(x.id === "custom" ? {} : { from: null, to: null }) })}
                className={cn(
                  "h-9 rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  period === x.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          {period === "custom" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input
                type="date"
                aria-label="From date"
                className={control}
                value={dates.from}
                max={a?.today}
                onChange={(e) => {
                  setDates((d) => ({ ...d, from: e.target.value }));
                  setParam({ from: e.target.value || null });
                }}
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                aria-label="To date"
                className={control}
                value={dates.to}
                max={a?.today}
                onChange={(e) => {
                  setDates((d) => ({ ...d, to: e.target.value }));
                  setParam({ to: e.target.value || null });
                }}
              />
              {!customOk ? <span className="text-xs text-muted-foreground">Choose both dates (To on or after From).</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            aria-label="Degree"
            className="w-full sm:w-40"
            value={degree}
            onValueChange={(v) => setParam({ degree: v || null, hall: null, section: null })}
            options={[{ value: "", label: "All degrees" }, ...asOptions(a?.options.degrees ?? [])]}
          />
          <Dropdown
            aria-label="Hall"
            className="w-full sm:w-40"
            value={hall === undefined ? "" : hall || NO_HALL}
            onValueChange={(v) => setParam({ hall: v === "" ? null : v === NO_HALL ? "" : v })}
            options={[{ value: "", label: "All halls" }, ...halls.map((h) => ({ value: h || NO_HALL, label: hallLabel(h) }))]}
            searchPlaceholder="Search halls…"
          />
          <Dropdown
            aria-label="Section"
            className="w-full sm:w-40"
            value={section}
            onValueChange={(v) => setParam({ section: v || null })}
            options={[{ value: "", label: "All sections" }, ...asOptions(sections)]}
            searchPlaceholder="Search sections…"
          />
          <Button
            variant="ghost"
            className="h-10"
            disabled={!filtered}
            onClick={() => {
              setDates({ from: "", to: "" });
              router.replace(pathname, { scroll: false });
            }}
          >
            Clear all filters
          </Button>
          {res.isFetching && a ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
        </div>
      </section>

      {res.isError ? (
        <EmptyState title="Couldn't load analytics" description={res.error.message} />
      ) : !a ? (
        period === "custom" && !customOk ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-8 text-center text-sm text-muted-foreground">Choose the dates to see the report.</p>
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-16 rounded-xl" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-5" data-testid="analytics-report">
          <ReportHeader a={a} />
          <Kpis a={a} onDrill={setDrill} />
          {a.total.working_days === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No attendance has been marked for {a.period === "today" ? "today" : "these dates"} yet, so there is nothing to compare.
            </p>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <DegreeSection a={a} onDrill={setDrill} />
                <InsightsCard a={a} />
              </div>
              <HallPctChart a={a} onDrill={setDrill} />
              <HallTable a={a} onDrill={setDrill} />
              {a.days > 1 ? <DailyTrend a={a} /> : null}
            </>
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Attendance % = present ÷ (present + absent). Unmarked is never counted as absent. A working day is a class day on which attendance was marked
            {a.days > 1 ? "; over several days present and absent are student-days (one student on one day), and “per day” is the average over the working days" : ""}.
          </p>
        </div>
      )}
      {a ? <AnalyticsDrill a={a} query={query} drill={drill} onClose={() => setDrill(null)} /> : null}
    </div>
  );
}

function ReportHeader({ a }: { a: Analytics }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-1 pb-4">
      <div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">DSA attendance report</p>
        <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground">{periodLabel(a)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{scopeLabel(a.filter)}</p>
      </div>
      <p className="text-xs text-muted-foreground">Generated {istTime.format(new Date(a.generated_at))} IST</p>
    </div>
  );
}

/* ---------- drill-down: the students behind a number ---------- */

type Focus = "pct" | "present" | "absent" | "unmarked";
/** What a click opens. degree / hall narrow the page filter (a degree or hall row). */
type Drill = { title: string; show: AnalyticsShow; focus: Focus; degree?: string; hall?: string };
type OnDrill = (d: Drill) => void;
type Sort = { label: string; compare: (x: AnalyticsStudent, y: AnalyticsStudent) => number };

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const dayMark = (r: AnalyticsStudent) => (r.present ? "Present" : r.absent ? "Absent" : "Not marked");
const byName = (x: AnalyticsStudent, y: AnalyticsStudent) => x.name.localeCompare(y.name);
const byMost = (k: "present" | "absent" | "unmarked") => (x: AnalyticsStudent, y: AnalyticsStudent) => y[k] - x[k] || byName(x, y);
const byPct = (dir: 1 | -1) => (x: AnalyticsStudent, y: AnalyticsStudent) => (x.pct === null ? 1 : y.pct === null ? -1 : dir * (x.pct - y.pct) || byName(x, y));

function sortsFor(focus: Focus, multi: boolean): Sort[] {
  const name = { label: "Name A–Z", compare: byName };
  if (!multi) return focus === "pct" ? [{ label: "Absent first", compare: byMost("absent") }, name] : [name];
  const low = { label: "Lowest % first", compare: byPct(1) };
  switch (focus) {
    case "pct":
      return [low, { label: "Highest % first", compare: byPct(-1) }, name];
    case "present":
      return [{ label: "Most present days", compare: byMost("present") }, low, name];
    case "absent":
      return [{ label: "Most absent days", compare: byMost("absent") }, low, name];
    default:
      return [{ label: "Most unmarked days", compare: byMost("unmarked") }, name];
  }
}

function AnalyticsDrill({ a, query, drill, onClose }: { a: Analytics; query: AnalyticsQuery; drill: Drill | null; onClose: () => void }) {
  const multi = a.days > 1;
  const q: AnalyticsQuery = drill ? { ...query, ...(drill.degree !== undefined ? { degree: drill.degree } : {}), ...(drill.hall !== undefined ? { hall: drill.hall } : {}) } : query;
  const res = useQuery({
    queryKey: ["attendance", "analytics-students", q, drill?.show],
    queryFn: () => attendanceApi.analyticsStudents(q, drill!.show),
    enabled: drill !== null,
  });
  const focus = drill?.focus ?? "pct";
  const sorts = sortsFor(focus, multi);
  const [sortIndex, setSortIndex] = useState(0);
  const [search, setSearch] = useState("");
  const match = searchMatcher(search);
  const term = search.trim();
  const rows = [...(res.data?.students ?? [])]
    .filter((r) => match(r.name, r.niat_id))
    .sort(sorts[Math.min(sortIndex, sorts.length - 1)].compare);
  const metric = (r: AnalyticsStudent) => (!multi ? dayMark(r) : focus === "pct" ? pct(r.pct) : days(r[focus]));
  const scope = { degree: q.degree ?? "", hall: q.hall === undefined ? null : q.hall, section: q.section ?? "" };

  return (
    <Sheet
      open={drill !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setSortIndex(0);
          setSearch("");
        }
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>{drill?.title}</SheetTitle>
          <SheetDescription>
            {periodLabel(a)} · {scopeLabel(scope)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or NIAT ID" aria-label="Search students" className={cn(control, "flex-1 sm:w-auto")} />
          {sorts.length > 1 ? (
            <Dropdown
              aria-label="Sort"
              className="w-full sm:w-48"
              value={String(sortIndex)}
              onValueChange={(v) => setSortIndex(Number(v))}
              options={sorts.map((s, i) => ({ value: String(i), label: s.label }))}
            />
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {res.isPending ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : res.isError ? (
            <p className="p-4 text-sm text-destructive">{res.error.message}</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{term ? `No student matches “${search.trim()}”.` : "No student in this group."}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.niat_id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/students/${r.niat_id}`} target="_blank" className="truncate text-sm font-semibold hover:text-primary hover:underline">
                      {r.name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {r.niat_id} · {r.degree} · {r.section} · {hallLabel(r.hall_no)}
                    </div>
                    {multi ? (
                      <div className="text-xs text-muted-foreground tabular">
                        Present {r.present} · Absent {r.absent} · Unmarked {r.unmarked}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular">{metric(r)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {res.data ? (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {term ? `${rows.length} of ${res.data.students.length}` : res.data.students.length} student{res.data.students.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/* ---------- KPI cards ---------- */

function Change({ a }: { a: Analytics }) {
  const c = a.insights.change;
  if (c === null) return <>{a.days === 1 ? "No earlier working day in the last 14 days" : "No marks in the previous period"} to compare</>;
  const word = c > 0 ? "up" : c < 0 ? "down" : "no change";
  return (
    <>
      {c > 0 ? "▲" : c < 0 ? "▼" : "■"} {c === 0 ? word : `${word} ${Math.abs(c).toFixed(2)} pts`} vs{" "}
      {a.period === "lastmonth"
        ? monthName.format(new Date(`${a.previous.from}T00:00:00Z`))
        : a.previous.from === a.previous.to
          ? formatDate(a.previous.from)
          : `${formatDate(a.previous.from)} – ${formatDate(a.previous.to)}`}
    </>
  );
}

function Kpi({ label, value, note, hero, onClick }: { label: string; value: string; note?: React.ReactNode; hero?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="text-[13px] font-medium text-sidebar-foreground">{label}</span>
      <span className={cn("font-heading text-[30px] leading-tight font-semibold tracking-tight tabular", hero && "text-primary")}>{value}</span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </>
  );
  const cls = cn("flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 text-left", hero ? "border-accent-border bg-accent/40" : "border-border");
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Kpis({ a, onDrill }: { a: Analytics; onDrill: OnDrill }) {
  const t = a.total;
  const multi = a.days > 1;
  const wd = `${t.working_days} working day${t.working_days === 1 ? "" : "s"}`;
  const open = (title: string, show: AnalyticsShow, focus: Focus, count: number) => (count > 0 ? () => onDrill({ title, show, focus }) : undefined);
  const unmarked = multi ? t.unmarked_students : t.unmarked;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi label="Eligible students" value={num(t.students)} note={multi ? `with a class in ${wd}` : "with class on this day"} onClick={open("Eligible students", "all", "pct", t.students)} />
      {multi ? (
        <>
          <Kpi label="Present per day (avg)" value={dec(t.avg_present)} note={`${num(t.present)} student-days over ${wd}`} onClick={open("Students with present days", "present", "present", t.present)} />
          <Kpi label="Absent per day (avg)" value={dec(t.avg_absent)} note={`${num(t.absent)} student-days over ${wd}`} onClick={open("Students with absent days", "absent", "absent", t.absent)} />
        </>
      ) : (
        <>
          <Kpi label="Students present" value={num(t.present)} onClick={open("Students present", "present", "present", t.present)} />
          <Kpi label="Students absent" value={num(t.absent)} onClick={open("Students absent", "absent", "absent", t.absent)} />
        </>
      )}
      <Kpi label="Attendance" value={pct(t.pct)} hero note={<Change a={a} />} onClick={open("Attendance by student", "all", "pct", t.students)} />
      <Kpi
        label={multi ? "Students with unmarked days" : "Students unmarked"}
        value={num(unmarked)}
        note={multi ? `${num(t.unmarked)} student-days without a mark` : "no mark yet; not counted as absent"}
        onClick={open(multi ? "Students with unmarked days" : "Students unmarked", "unmarked", "unmarked", unmarked)}
      />
    </div>
  );
}

/* ---------- shared pieces ---------- */

function Panel({ title, subtitle, legend, children }: { title: string; subtitle?: string; legend?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {legend ? <PresentAbsentLegend /> : null}
      </div>
      {children}
    </section>
  );
}

function PresentAbsentLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-viz-present" /> Present
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-viz-absent" /> Absent
      </span>
    </div>
  );
}

type TipState = { x: number; y: number; lines: string[] } | null;

function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  const bind = (lines: string[]) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, lines }),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, lines });
    },
    onBlur: () => setTip(null),
    "aria-label": lines.join(", "),
  });
  const view = tip ? (
    <div role="tooltip" className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg" style={{ left: tip.x, top: tip.y - 10 }}>
      <div className="font-semibold text-foreground">{tip.lines[0]}</div>
      {tip.lines.slice(1).map((l) => (
        <div key={l} className="text-muted-foreground tabular">
          {l}
        </div>
      ))}
    </div>
  ) : null;
  return { bind, view };
}

const tallyLines = (name: string, t: Tally | DayTally, multi: boolean) => [
  name,
  `Present ${num(t.present)}${multi ? " student-days" : ""}`,
  `Absent ${num(t.absent)}`,
  `Unmarked ${num(t.unmarked)}`,
  `Attendance ${pct(t.pct)}`,
];

/** Present | absent share of the marked days. */
function SplitBar({ t, tip }: { t: Tally; tip: ReturnType<ReturnType<typeof useTip>["bind"]> }) {
  const marked = t.present + t.absent;
  const p = marked ? (t.present / marked) * 100 : 0;
  return (
    <div className="flex h-3 flex-1 gap-[2px] overflow-hidden rounded-full bg-muted" {...tip}>
      {t.present > 0 ? <div className="h-full rounded-l-full bg-viz-present" style={{ width: `${p}%` }} /> : null}
      {t.absent > 0 ? <div className="h-full flex-1 rounded-r-full bg-viz-absent" /> : null}
    </div>
  );
}

const rowHover = "cursor-pointer transition-colors hover:bg-muted/60";

/** The first cell's keyboard button for a row that opens a drill-down. */
function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="rounded font-semibold text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

const hallDrill = (h: GroupTally): Drill => ({ title: `${h.degree} · ${hallLabel(h.hall ?? "")}`, show: "all", focus: "pct", degree: h.degree, hall: h.hall ?? "" });
const th = "px-2 py-2 text-right font-medium";

/* ---------- degree ---------- */

function DegreeSection({ a, onDrill }: { a: Analytics; onDrill: OnDrill }) {
  const multi = a.days > 1;
  const tip = useTip();
  const degreeDrill = (name: string, total?: boolean): Drill => (total ? { title: "Eligible students", show: "all", focus: "pct" } : { title: `${name} students`, show: "all", focus: "pct", degree: name });
  const rows: { name: string; t: Tally; total?: boolean }[] = [...a.degrees.map((d) => ({ name: d.degree, t: d as Tally })), ...(a.degrees.length > 1 ? [{ name: "Total", t: a.total, total: true }] : [])];
  return (
    <Panel title="By degree" subtitle={a.degrees.length > 1 ? `${a.degrees.map((d) => d.degree).join(" vs ")} comparison` : undefined} legend>
      <div className="flex flex-col gap-3">
        {a.degrees.map((d) => (
          <div key={d.degree} className={cn("-mx-2 grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1", rowHover)} onClick={() => onDrill(degreeDrill(d.degree))}>
            <span className="text-sm font-semibold text-foreground">{d.degree}</span>
            <SplitBar t={d} tip={tip.bind(tallyLines(d.degree, d, multi))} />
            <span className="text-right text-sm font-semibold text-foreground tabular">{pct(d.pct)}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 text-left font-medium">Degree</th>
              <th className={th}>Students</th>
              <th className={th}>Present{multi ? <span className="block font-normal">student-days</span> : null}</th>
              <th className={th}>Absent{multi ? <span className="block font-normal">student-days</span> : null}</th>
              <th className={th}>Unmarked</th>
              {multi ? <th className={th}>Present / day</th> : null}
              <th className="py-2 pl-2 text-right font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(({ name, t, total }) => (
              <tr key={name} className={cn(total ? "border-t-2 border-border font-semibold" : "border-b border-border/60", t.students ? rowHover : "")} onClick={t.students ? () => onDrill(degreeDrill(name, total)) : undefined}>
                <td className="py-2 pr-3 text-foreground">
                  {t.students ? (
                    <RowButton label={`Show ${total ? "all" : name} students`} onClick={() => onDrill(degreeDrill(name, total))}>
                      {name}
                    </RowButton>
                  ) : (
                    name
                  )}
                </td>
                <td className="px-2 py-2 text-right">{num(t.students)}</td>
                <td className="px-2 py-2 text-right">{num(t.present)}</td>
                <td className="px-2 py-2 text-right">{num(t.absent)}</td>
                <td className="px-2 py-2 text-right">{num(t.unmarked)}</td>
                {multi ? <td className="px-2 py-2 text-right">{dec(t.avg_present)}</td> : null}
                <td className="py-2 pl-2 text-right font-semibold text-foreground">{pct(t.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tip.view}
    </Panel>
  );
}

/* ---------- insights ---------- */

function InsightsCard({ a }: { a: Analytics }) {
  const i = a.insights;
  const items: { label: string; value: React.ReactNode }[] = [];
  if (i.top_degrees.length) items.push({ label: "Highest attendance degree", value: `${i.top_degrees.join(", ")} · ${pct(i.top_degree_pct)}` });
  if (i.top_halls.length) items.push({ label: "Highest attendance hall", value: `${i.top_halls.join(", ")} · ${pct(i.top_hall_pct)}` });
  if (i.bottom_halls.length) items.push({ label: "Lowest attendance hall", value: `${i.bottom_halls.join(", ")} · ${pct(i.bottom_hall_pct)}` });
  items.push({
    label: a.days === 1 ? "Compared with the previous working day" : a.period === "lastmonth" ? "Compared with the month before" : "Compared with the previous period",
    value: (
      <>
        <Change a={a} />
        {i.prev_pct !== null ? <span className="text-muted-foreground"> ({pct(i.prev_pct)})</span> : null}
      </>
    ),
  });
  items.push({
    label: "Unmarked attendance",
    value: a.total.unmarked_students === 0 ? "Every eligible student is marked" : `${num(a.total.unmarked_students)} student${a.total.unmarked_students === 1 ? "" : "s"} (${num(a.total.unmarked)} student-days)`,
  });
  items.push({ label: "Working days covered", value: `${a.total.working_days} of ${a.days} calendar day${a.days === 1 ? "" : "s"}` });
  return (
    <Panel title="Key insights">
      <ul className="flex flex-col divide-y divide-border/70">
        {items.map((it) => (
          <li key={it.label} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
            <span className="text-xs text-muted-foreground">{it.label}</span>
            <span className="text-sm font-semibold text-foreground">{it.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- halls ---------- */

const byDegree = (halls: GroupTally[]) => {
  const m = new Map<string, GroupTally[]>();
  for (const h of halls) m.set(h.degree, [...(m.get(h.degree) ?? []), h]);
  return [...m.entries()];
};

function HallPctChart({ a, onDrill }: { a: Analytics; onDrill: OnDrill }) {
  const multi = a.days > 1;
  const tip = useTip();
  const groups = byDegree(a.halls);
  return (
    <Panel title="Attendance % by hall" subtitle="Highest first, within each degree">
      <div className={cn("grid gap-6", groups.length > 1 && "md:grid-cols-2")}>
        {groups.map(([deg, halls]) => (
          <div key={deg} className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{deg}</span>
            {[...halls]
              .sort((x, y) => (y.pct ?? -1) - (x.pct ?? -1))
              .map((h) => (
                <div
                  key={h.hall ?? ""}
                  role="button"
                  tabIndex={0}
                  className={cn("-mx-2 grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", rowHover)}
                  {...tip.bind(tallyLines(`${deg} · ${hallLabel(h.hall ?? "")}`, h, multi))}
                  onClick={() => onDrill(hallDrill(h))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDrill(hallDrill(h));
                    }
                  }}
                >
                  <span className="truncate text-sm text-foreground">{hallLabel(h.hall ?? "")}</span>
                  <div className="h-3 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-viz-present" style={{ width: `${h.pct ?? 0}%` }} />
                  </div>
                  <span className="text-right text-sm font-semibold text-foreground tabular">{pct(h.pct)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      {tip.view}
    </Panel>
  );
}

function HallTable({ a, onDrill }: { a: Analytics; onDrill: OnDrill }) {
  const multi = a.days > 1;
  const tip = useTip();
  return (
    <Panel title="Hall-wise attendance" subtitle={multi ? "Present and absent are student-days" : undefined} legend>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 text-left font-medium">Degree</th>
              <th className="px-2 py-2 text-left font-medium">Hall</th>
              <th className={th}>Students</th>
              <th className={th}>Present</th>
              <th className={th}>Absent</th>
              <th className={th}>Unmarked</th>
              {multi ? <th className={th}>Present / day</th> : null}
              <th className="hidden w-40 px-3 py-2 text-left font-medium sm:table-cell">Present vs absent</th>
              <th className="py-2 pl-2 text-right font-medium">Attendance</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {byDegree(a.halls).map(([deg, halls]) =>
              halls.map((h, i) => (
                <tr key={deg + (h.hall ?? "")} className={cn("border-b border-border/60", i === 0 && "border-t border-t-border", rowHover)} onClick={() => onDrill(hallDrill(h))}>
                  <td className="py-2 pr-3 font-semibold text-foreground">{i === 0 ? deg : ""}</td>
                  <td className="px-2 py-2 text-foreground">
                    <RowButton label={`Show ${deg} ${hallLabel(h.hall ?? "")} students`} onClick={() => onDrill(hallDrill(h))}>
                      {hallLabel(h.hall ?? "")}
                    </RowButton>
                  </td>
                  <td className="px-2 py-2 text-right">{num(h.students)}</td>
                  <td className="px-2 py-2 text-right">{num(h.present)}</td>
                  <td className="px-2 py-2 text-right">{num(h.absent)}</td>
                  <td className="px-2 py-2 text-right">{num(h.unmarked)}</td>
                  {multi ? <td className="px-2 py-2 text-right">{dec(h.avg_present)}</td> : null}
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <SplitBar t={h} tip={tip.bind(tallyLines(`${deg} · ${hallLabel(h.hall ?? "")}`, h, multi))} />
                  </td>
                  <td className="py-2 pl-2 text-right font-semibold text-foreground">{pct(h.pct)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      {tip.view}
    </Panel>
  );
}

/* ---------- daily trend ---------- */

function niceMax(n: number) {
  if (n <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

function DailyTrend({ a }: { a: Analytics }) {
  const tip = useTip();
  const max = niceMax(Math.max(...a.daily.map((d) => d.present + d.absent)));
  const ticks = [0, max / 2, max];
  const showPct = a.daily.length <= 12;
  const every = Math.ceil(a.daily.length / 7); // at most ~7 date labels, so they fit on a phone
  const short = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <Panel title="Daily attendance" subtitle="Students present and absent on each working day; % above each bar" legend>
      <div className="flex gap-2">
        <div className="relative w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular" style={{ height: 200 }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>
              {num(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: 200 }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border/60" style={{ top: `${100 - (t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {a.daily.map((d) => {
                const h = ((d.present + d.absent) / max) * 100;
                return (
                  <div key={d.date} tabIndex={0} className="relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none" {...tip.bind(tallyLines(formatDate(d.date), d, false))}>
                    {showPct ? (
                      <span className="absolute inset-x-0 text-center text-[10px] font-medium text-muted-foreground tabular" style={{ bottom: `calc(${h}% + 4px)` }}>
                        {d.pct === null ? "" : `${Math.round(d.pct)}%`}
                      </span>
                    ) : null}
                    <div className="mx-auto flex w-full max-w-12 flex-col gap-[2px]" style={{ height: `${h}%` }}>
                      {d.absent > 0 ? <div className="rounded-t-[4px] bg-viz-absent" style={{ flex: d.absent }} /> : null}
                      {d.present > 0 ? <div className={cn("bg-viz-present", d.absent > 0 ? "" : "rounded-t-[4px]")} style={{ flex: d.present }} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1.5 flex gap-[3px] text-[10px] text-muted-foreground">
            {a.daily.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 truncate text-center">
                {i % every === 0 ? short(d.date) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      {tip.view}
    </Panel>
  );
}
