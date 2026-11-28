/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusPill } from "@/common/components/chips";
import { PageHeader } from "@/common/components/page-header";
import { RecentLogs } from "@nxtone/interactions-ui/components/recent-logs";
import { InteractionInspect } from "@/modules/students/components/interaction-inspect";
import { OverdueBanner, OverduePill, OverdueReminder } from "@nxtone/interactions-ui/components/overdue-banner";
import { OVERDUE_COOKIE, overdueStartsOpen, parseOverduePref } from "@nxtone/interactions-ui/lib/overdue-cookie";
import { MyStudents } from "@nxtone/interactions-ui/components/my-students";
import { isOverdue, myStudentsList, scopedStudents } from "@nxtone/interactions-ui/my-students-data";
import { usingSampleData } from "@/common/data/roster";
import { roomsByInteraction } from "@nxtone/interactions-ui/room/data";
import { Skeleton } from "@/common/ui/skeleton";
import { requireAccess } from "@/common/auth/guard";
import { addDays, todayIst } from "@/common/lib/dates";
import { listInteractions } from "@nxtone/interactions-ui/data";
import { isSupport } from "@nxtone/interactions-ui/lib/types";
import { PocSummary } from "@nxtone/interactions-ui/components/poc-summary";
import { filterLog } from "@nxtone/interactions-ui/lib/log-filter";
import { canLogInteractions } from "@nxtone/interactions-ui/lib/permissions";
import { RISK_THRESHOLDS } from "@/common/domain/risk";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { SectionCard } from "@/common/components/section-card";
import { LiveForm } from "@/common/components/live-form";
import { Dropdown } from "@/common/components/dropdown";
import { asOptions } from "@/common/lib/options";
import { DateRange } from "@/common/components/date-range";
import { DailyBars } from "@/common/components/charts";
import { eachDay, parseRange, shortDay } from "@/common/lib/range";

export const metadata = { title: "Interactions" };

async function InteractionsContent({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  // "Today" and the logs are request-time data: render per request, never from a prerender.
  await connection();
  const user = await requireAccess("/interactions");
  const params = await searchParams;
  // Old links opened the form here; logging has its own page now.
  if (typeof params.student === "string" && params.student) redirect(`/log-interaction?niat=${encodeURIComponent(params.student.toUpperCase())}`);
  // Instructors and senior instructors log for their own students; coaches read their coached students' logs.
  const logging = canLogInteractions(user);
  // Admins, super admins and senior instructors get the all-students view (every interaction, the
  // person filters, the By-person table). Senior instructors also keep their own "My students" list.
  const adminView = !logging || user.role === "senior_instructor";
  const sample = usingSampleData();
  const { scope, roster, students: myStudents } = await scopedStudents(user);
  // The interactions this page lists: everyone's in the admin view, otherwise the person's own students.
  const listScope = user.role === "senior_instructor" ? undefined : scope;
  const [all, mine] = await Promise.all([
    listInteractions(listScope?.coach !== undefined ? { niatIds: myStudents.map((s) => s.niatId) } : { instructor: listScope?.instructor }),
    myStudentsList(user),
  ]);
  const overdue = (user.role === "senior_instructor" ? roster : myStudents).filter(isOverdue);
  // Whether the Overdue banner starts open (its toggle is remembered in a cookie).
  const overduePref = parseOverduePref((await cookies()).get(OVERDUE_COOKIE)?.value);
  const today = todayIst();
  const weekAgo = addDays(today, -7);
  const thisWeek = all.filter((it) => it.date > weekAgo).length;
  const todayCount = all.filter((it) => it.date === today).length;

  // Activity for the chosen dates, optionally for one person who took the interactions ("by") and/or
  // one POC whose students got them ("poc": the student's instructor when the interaction was logged).
  const range = parseRange(params, today, 30);
  const takenBy = typeof params.by === "string" && params.by ? params.by : null;
  const poc = typeof params.poc === "string" && params.poc ? params.poc : null;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const people = [...new Set(all.map((it) => it.takenBy))].sort();
  const pocs = [...new Set(all.map((it) => it.pocAtTime).filter(Boolean))].sort();
  // Same filter as Today's interactions and the CSV export, so "See all" and Export hold these exact rows.
  const filter = { from: range.from, to: range.to, q, takenBy, poc };
  const inRange = filterLog(all, filter);
  const bySupport = inRange.filter(isSupport).length;
  const recent = inRange.slice(0, 40);
  const exportHref = withParams("/api/logs/interactions/export", {}, { from: range.from, to: range.to, q: q.trim() || null, by: takenBy, poc });
  const allHref = withParams("/interactions/today", {}, { from: range.from, to: range.to, q: q.trim() || null, by: takenBy, poc });
  const codeRooms = await roomsByInteraction(recent.map((it) => it.id));
  const perDay = new Map<string, number>();
  for (const it of inRange) perDay.set(it.date, (perDay.get(it.date) ?? 0) + 1);
  const daily = eachDay(range).map((day) => ({ day, label: shortDay(day), value: perDay.get(day) ?? 0 }));
  const busiest = daily.reduce((best, d) => (d.value > (best?.value ?? 0) ? d : best), null as (typeof daily)[number] | null);
  const reached = new Set(inRange.map((it) => it.niatId)).size;
  const n = (v: number) => v.toLocaleString("en-IN");
  const plural = (v: number, one: string) => `${n(v)} ${one}${v === 1 ? "" : "s"}`;
  // Each card: what it counts, the number, and a line that says how to read it.
  const activity: { label: string; value: string; note: string }[] = [
    { label: "Total interactions", value: n(inRange.length), note: "Logged in the selected dates" },
    {
      label: "Day with the most interactions",
      value: busiest && busiest.value ? busiest.label : "—",
      note: busiest && busiest.value ? `${plural(busiest.value, "interaction")} that day` : "No interactions in these dates",
    },
    { label: "Unique students given an interaction", value: n(reached), note: "Each student counted once" },
    {
      label: "Interactions taken by a support instructor",
      value: inRange.length ? `${n(bySupport)} · ${Math.round((bySupport / inRange.length) * 100)}%` : "0",
      note: "Taken by someone other than the student's own POC",
    },
  ];
  const showPeople = adminView;

  const overdueLabel = `${overdue.length} ${adminView ? "students" : "of my students"} overdue (${RISK_THRESHOLDS.interactionGapDays}d+)`;
  // Instructors with overdue students: the pill is a button that shows/hides the list below it.
  // (Senior instructors see their own overdue students in My students instead.)
  const overdueReminder = !adminView && overdue.length > 0;

  return (
    <OverdueReminder
      count={overdue.length}
      initialOpen={overdueStartsOpen(overduePref, overdue.length)}
      seen={overduePref.open ? null : overduePref.seen}
    >
      <PageHeader
        eyebrow={adminView ? "Interactions · all students" : `Interactions · my students (${myStudents.length})`}
        title="Interactions"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {overdueReminder ? (
              <OverduePill>{overdueLabel}</OverduePill>
            ) : (
              <StatusPill tone={overdue.length ? "warning" : "accent"}>{overdueLabel}</StatusPill>
            )}
            <StatusPill tone="accent">{thisWeek} logged this week</StatusPill>
            {sample ? <StatusPill>Sample data</StatusPill> : null}
            <Link
              href="/interactions/today"
              className="ml-1 inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted"
            >
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
              Today&apos;s interactions
              <span className="rounded-md bg-muted px-1.5 text-xs tabular text-muted-foreground">{todayCount}</span>
            </Link>
            {logging ? (
              <Link href="/log-interaction" className="ml-1 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Log interaction
              </Link>
            ) : null}
          </div>
        }
      />

      {overdueReminder ? (
        <OverdueBanner students={overdue.map((s) => ({ niatId: s.niatId, name: s.name, days: s.lastInteractionDays }))} />
      ) : null}

      {mine ? <MyStudents students={mine} overdueDays={RISK_THRESHOLDS.interactionGapDays} /> : null}

      {adminView ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
          Interactions are logged by the assigned instructor.{" "}
          {user.role === "senior_instructor"
            ? "As a Senior instructor you can read and export every log, and log for your own students (My students above)."
            : `As ${user.role === "owner" ? "a Super admin" : "an Admin"} you can read and export every log.`}
        </p>
      ) : null}

      <SectionCard
        title="Interactions"
        description={`${shortDay(range.from)} – ${shortDay(range.to)}${poc ? ` · ${poc}'s students` : ""}${takenBy ? ` · taken by ${takenBy}` : ""}${q.trim() ? ` · matching “${q.trim()}”` : ""}`}
      >
        <div className="flex flex-col gap-4">
          <LiveForm className="flex flex-wrap items-end gap-3" aria-label="Filter interactions">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Search
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Student, NIAT ID, topic or instructor"
                className="h-10 w-72 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </label>
            {/* Everyone (super admins too) gets Today / This month; any other dates are under Custom. */}
            <DateRange from={range.from} to={range.to} today={today} quick={["Today", "This month"]} />
            {showPeople ? (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  POC (students of)
                  <Dropdown
                    name="poc"
                    defaultValue={poc ?? ""}
                    options={[{ value: "", label: "Every POC" }, ...asOptions(pocs)]}
                    searchPlaceholder="Search POCs…"
                    className="w-56"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Taken by
                  <Dropdown
                    name="by"
                    defaultValue={takenBy ?? ""}
                    options={[{ value: "", label: "Everyone" }, ...asOptions(people)]}
                    searchPlaceholder="Search people…"
                    className="w-56"
                  />
                </label>
              </>
            ) : null}
          </LiveForm>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {activity.map(({ label, value, note }) => (
              <div key={label} className="flex flex-col rounded-xl border border-border px-3.5 py-2.5">
                <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                <dd className="font-heading text-xl font-semibold tabular">{value}</dd>
                <dd className="text-xs text-muted-foreground">{note}</dd>
              </div>
            ))}
          </dl>
          <DailyBars data={daily} valueLabel="Interactions" />
          <p className="sr-only">{daily.map((d) => `${d.label}: ${d.value}`).join(", ")}</p>
        </div>
      </SectionCard>

      {showPeople ? (
        <SectionCard
          title="By person"
          bodyClassName="px-0 pb-2"
        >
          <PocSummary rows={all.map((it) => ({ date: it.date, takenBy: it.takenBy, poc: it.pocAtTime }))} from={range.from} to={range.to} today={today} params={params} />
        </SectionCard>
      ) : null}

      <RecentLogs
        rows={recent}
        total={inRange.length}
        exportHref={exportHref}
        allHref={inRange.length > recent.length ? allHref : undefined}
        codeRooms={codeRooms}
        linkStudents={user.role === "owner" || user.role === "admin" || user.role === "senior_instructor"}
        actions={Object.fromEntries(recent.map((it) => [it.id, <InteractionInspect key={it.id} niatId={it.niatId} interactionId={it.id} studentName={it.studentName} />]))}
      />
    </OverdueReminder>
  );
}

export default function InteractionsPage({ searchParams }: PageProps<"/interactions">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading interactions">
          <Skeleton className="h-16 w-96" />
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[640px] flex-[1_1_440px] rounded-xl" />
            <Skeleton className="h-[480px] flex-[1.5_1_560px] rounded-xl" />
          </div>
        </div>
      }
    >
      <InteractionsContent searchParams={searchParams} />
    </Suspense>
  );
}
