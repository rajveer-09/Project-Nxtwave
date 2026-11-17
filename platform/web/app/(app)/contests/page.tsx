/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { Suspense } from "react";
import { BarList } from "@/common/components/bar-list";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { ContestsList } from "@nxtone/contest-ui/components/contests-list";
import { Skeleton } from "@/common/ui/skeleton";
import { authMode } from "@/common/auth/config";
import { requireAccess } from "@/common/auth/guard";
import { getRoster } from "@/common/data/roster";
import { shortDay } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";
import { collegePerformance, contestPerformance, type ContestRow } from "@nxtone/contest-ui/performance";

export const metadata = { title: "Contests" };

const connected = !!(process.env.CONTEST_API_ORIGIN && process.env.CONTEST_JWT_SECRET);
const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part * 100) / whole)}%` : "—");
const shortTitle = (t: string) => t.replace(/^(Weekly|Biweekly) Contest /, "$1 ");

type View = "mine" | "all" | "colleges";

function Tabs({ view, views }: { view: View; views: [View, string][] }) {
  return (
    <nav aria-label="Contest views" className="flex flex-wrap gap-1 border-b border-border">
      {views.map(([key, label]) => (
        <Link
          key={key}
          href={`/contests?view=${key}`}
          scroll={false}
          aria-current={view === key ? "page" : undefined}
          className={cn(
            "-mb-px flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold",
            view === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function MyContests({ rows, students }: { rows: ContestRow[]; students: number }) {
  if (!rows.length) return <EmptyState title="No scanned contests yet" description="Results show here after the scanner reads a contest." />;
  return (
    <section aria-label="Your students in recent contests" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-base font-semibold">Your students in recent contests</h2>
        <span className="text-xs text-muted-foreground">{fmt(students)} students · took part ÷ students with a LeetCode handle</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <caption className="sr-only">Your students in recent contests</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              {["Contest", "Took part", "Avg solved", "Solved all 4", "Best global rank"].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="hover:bg-surface-subtle">
                <td className="border-b border-muted py-3 pr-3 pl-5">
                  <Link href={`/contests/${r.slug}`} className="font-semibold hover:text-primary">
                    {r.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{shortDay(r.day)}</div>
                </td>
                <td className="border-b border-muted px-3 py-3 tabular">
                  {r.tookPart} of {r.handles} · <b>{pct(r.tookPart, r.handles)}</b>
                </td>
                <td className="border-b border-muted px-3 py-3 tabular">{r.avgSolved !== null ? `${r.avgSolved.toFixed(1)} / 4` : "—"}</td>
                <td className="border-b border-muted px-3 py-3 tabular">{r.solvedAll}</td>
                <td className="border-b border-muted py-3 pr-5 pl-3 tabular">{r.bestRank ? fmt(r.bestRank) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Colleges() {
  const { contests, colleges } = await collegePerformance(8);
  if (!contests.length) return <EmptyState title="No scanned contests yet" description="Results show here after the scanner reads a contest." />;
  const span = `${shortTitle(contests[0].title)} – ${shortTitle(contests.at(-1)!.title)}`;
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="College-wise performance" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">College-wise performance · all NxtWave students</h2>
          <span className="text-xs text-muted-foreground">
            Last {contests.length} contests · {span}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <caption className="sr-only">College-wise contest performance</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["College", "Students", "With a handle", "Participation", "Avg solved", "Solved all 4", "Best global rank"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.college}>
                  <td className="border-b border-muted py-3 pr-3 pl-5 font-semibold">{c.college}</td>
                  <td className="border-b border-muted px-3 py-3 tabular">{fmt(c.students)}</td>
                  <td className="border-b border-muted px-3 py-3 tabular">
                    {fmt(c.withHandle)} · {pct(c.withHandle, c.students)}
                  </td>
                  <td className="border-b border-muted px-3 py-3 font-semibold tabular">{c.participation !== null ? `${c.participation}%` : "—"}</td>
                  <td className="border-b border-muted px-3 py-3 tabular">{c.avgSolved !== null ? `${c.avgSolved.toFixed(2)} / 4` : "—"}</td>
                  <td className="border-b border-muted px-3 py-3 tabular">{fmt(c.solvedAll)}</td>
                  <td className="border-b border-muted py-3 pr-5 pl-3 tabular">{c.bestRank ? fmt(c.bestRank) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
          Participation = took part ÷ students with a usable handle, over these contests. Avg solved is per student who took part.
        </p>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {colleges.map((c) => (
          <SectionCard key={c.college} title={`${c.college} · participation by contest`} description="Took part ÷ students with a handle">
            <BarList
              items={c.trend.map((t) => ({ label: shortTitle(t.title), value: t.pct ?? 0, display: t.pct === null ? "—" : `${t.pct}%` }))}
              max={100}
              labelWidth="7.5rem"
            />
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/contests");
  const params = await searchParams;
  const db = authMode() === "database";
  // Instructors (and senior instructors who teach) start on their own students.
  const teaches = user.role === "instructor" || user.role === "senior_instructor";
  const myIds = teaches && db ? (await getRoster()).filter((s) => s.instructor === user.name).map((s) => s.niatId) : [];
  const hasMine = myIds.length > 0;
  const views: [View, string][] = [...(hasMine ? ([["mine", "My students"]] as [View, string][]) : []), ["all", "All contests"], ...(db ? ([["colleges", "By college"]] as [View, string][]) : [])];
  const asked = typeof params.view === "string" ? (params.view as View) : null;
  const view: View = asked && views.some(([k]) => k === asked) ? asked : hasMine ? "mine" : "all";

  return (
    <div className="flex flex-col gap-5">
      {views.length > 1 ? <Tabs view={view} views={views} /> : null}
      {view === "mine" ? (
        <MyContests rows={await contestPerformance(myIds, 10)} students={myIds.length} />
      ) : view === "colleges" ? (
        <Colleges />
      ) : (
        <ContestsList defaultScope={user.role === "instructor" ? "mine" : "all"} />
      )}
    </div>
  );
}

export default function ContestsPage({ searchParams }: PageProps<"/contests">) {
  return (
    <>
      <PageHeader
        eyebrow="LeetCode contests · scanned automatically"
        title="Contests"
        actions={connected ? null : <StatusPill>Sample contest service · NxtRank not connected</StatusPill>}
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
