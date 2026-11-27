/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { connection } from "next/server";
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
import { shortDay } from "@/common/lib/range";
import type { SearchParamsRecord } from "@/common/lib/url";
import { cn } from "@/common/lib/utils";
import { collegePerformance, contestPerformance, topKRanking, topThreeByContest, type ContestRow } from "@nxtone/contest-ui/performance";
import { listTopK, seesAllTopK, topKReady, type TopKStudent } from "@/modules/top-k/data";
import { canAccess } from "@/common/lib/nav";
import { LiveForm } from "@/common/components/live-form";
import { Dropdown } from "@/common/components/dropdown";
import { idsByCollege, myStudentIds } from "@nxtone/contest-ui/my-students";
import { TopicsView } from "@nxtone/contest-ui/components/topics";

export const metadata = { title: "Contests" };

/** Read when the page is opened, not at build time (the one-container image sets the origin at start). */
async function ServicePill() {
  await connection();
  if (process.env.CONTEST_API_ORIGIN && process.env.CONTEST_JWT_SECRET) return null;
  return <StatusPill>Sample contest service · NxtRank not connected</StatusPill>;
}
const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part * 100) / whole)}%` : "—");
const shortTitle = (t: string) => t.replace(/^(Weekly|Biweekly) Contest /, "$1 ");

type View = "mine" | "all" | "colleges" | "topics" | "topk";

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

/**
 * Contests › Top K: the Top K students (an instructor's own; everyone's, or one instructor's, for
 * senior instructors and admins) ranked among themselves over the latest contests, then each
 * contest's Top K turnout and best three.
 */
async function TopKContests({ students, seesAll, poc, db, ready }: { students: TopKStudent[]; seesAll: boolean; poc: string; db: boolean; ready: boolean }) {
  if (!ready) return <EmptyState title="Top K isn't set up yet" description="Its table hasn't been added to this database." />;
  if (!db) return <EmptyState title="Top K contest results need the database" description="Contest results are read from the contest data." />;
  const pocs = [...new Set(students.map((s) => s.instructor))].sort();
  const picked = seesAll && poc && pocs.includes(poc) ? poc : "";
  const chosen = picked ? students.filter((s) => s.instructor === picked) : students;
  const ids = chosen.map((s) => s.niatId);
  const byId = new Map(chosen.map((s) => [s.niatId, s]));
  if (!ids.length) {
    return <EmptyState title={seesAll ? "No Top K students yet" : "Your Top K is empty"} description="Pick Top K students on the Top K page; their contest results show here." />;
  }
  const [ranking, contests, top3] = await Promise.all([topKRanking(ids, 10), contestPerformance(ids, 10), topThreeByContest(ids, 10)]);
  const missing = ids.length - ranking.length;
  const whose = seesAll ? (picked ? `${picked}’s Top K` : "Every instructor’s Top K") : "Your Top K";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          {whose} · {fmt(ids.length)} students
          {missing > 0 ? ` · ${missing} not in the contest tracker` : ""} ·{" "}
          <Link href="/top-k" className="font-semibold text-primary hover:text-accent-strong">
            Manage Top K →
          </Link>
        </p>
        {seesAll ? (
          <LiveForm className="flex items-end gap-2" aria-label="Whose Top K">
            <input type="hidden" name="view" value="topk" />
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Instructor (POC)
              <Dropdown
                name="poc"
                defaultValue={picked}
                options={[{ value: "", label: "All instructors" }, ...pocs.map((p) => ({ value: p, label: `${p} (${students.filter((s) => s.instructor === p).length})` }))]}
                searchPlaceholder="Search instructors…"
                className="w-64"
              />
            </label>
          </LiveForm>
        ) : null}
      </div>

      <section aria-label="Top K ranking" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Top K ranking · last 10 contests</h2>
          <span className="text-xs text-muted-foreground">By total problems solved, then how often they took part, then best rank</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <caption className="sr-only">Top K students ranked over the last 10 contests</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["#", "Student", ...(seesAll ? ["POC"] : []), "Total solved", "Took part", "Avg solved", "Best global rank", "Last contest"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.niatId} className="hover:bg-surface-subtle">
                  <td className="border-b border-muted py-2.5 pr-3 pl-5 font-bold tabular">{i + 1}</td>
                  <td className="border-b border-muted px-3 py-2.5">
                    <Link href={`/contests/students/${r.niatId}`} className="font-semibold hover:text-primary hover:underline">
                      {byId.get(r.niatId)?.name ?? r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground tabular">{r.niatId}</div>
                  </td>
                  {seesAll ? <td className="border-b border-muted px-3 py-2.5">{byId.get(r.niatId)?.instructor ?? "—"}</td> : null}
                  <td className="border-b border-muted px-3 py-2.5 font-semibold tabular">{r.solved}</td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">
                    {r.tookPart} of {r.scanned}
                  </td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">{r.avgSolved !== null ? `${r.avgSolved.toFixed(1)} / 4` : "—"}</td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">{r.bestRank ? fmt(r.bestRank) : "—"}</td>
                  <td className="border-b border-muted py-2.5 pr-5 pl-3 text-xs">
                    {r.last ? (
                      <>
                        {shortTitle(r.last.title)} · <span className={r.last.solved === null ? "text-warning" : ""}>{r.last.solved === null ? "absent" : `${r.last.solved} solved`}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Top K by contest" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">Contest by contest</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <caption className="sr-only">Top K in each of the latest contests</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["Contest", "Took part", "Avg solved", "Solved all 4", "Best three"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-3 py-2.5 first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contests.map((c) => (
                <tr key={c.slug} className="hover:bg-surface-subtle">
                  <td className="border-b border-muted py-2.5 pr-3 pl-5">
                    <Link href={`/contests/${c.slug}`} className="font-semibold hover:text-primary">
                      {c.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{shortDay(c.day)}</div>
                  </td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">
                    {c.tookPart} of {c.handles} · <b>{pct(c.tookPart, c.handles)}</b>
                  </td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">{c.avgSolved !== null ? `${c.avgSolved.toFixed(1)} / 4` : "—"}</td>
                  <td className="border-b border-muted px-3 py-2.5 tabular">{c.solvedAll}</td>
                  <td className="border-b border-muted py-2.5 pr-5 pl-3">
                    {top3[c.slug]?.length ? (
                      <ol className="flex flex-col gap-0.5 text-xs">
                        {top3[c.slug].map((t, i) => (
                          <li key={t.niatId}>
                            <span className="font-bold tabular">{i + 1}.</span> {byId.get(t.niatId)?.name ?? t.name} · {t.solved} solved{t.rank ? ` · #${fmt(t.rank)}` : ""}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <span className="text-xs text-muted-foreground">No one took part</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const user = await requireAccess("/contests");
  const params = await searchParams;
  const db = authMode() === "database";
  // Instructors (and senior instructors who teach) start on their own students.
  const myIds = await myStudentIds(user);
  const hasMine = myIds.length > 0;
  const views: [View, string][] = [
    ...(hasMine ? ([["mine", "My students"]] as [View, string][]) : []),
    ["all", "All contests"],
    ...(db ? ([["colleges", "By college"]] as [View, string][]) : []),
    ["topics", "Topics"],
    ...(canAccess(user.role, "/top-k") ? ([["topk", "Top K"]] as [View, string][]) : []),
  ];
  const asked = typeof params.view === "string" ? (params.view as View) : null;
  const view: View = asked && views.some(([k]) => k === asked) ? asked : hasMine ? "mine" : "all";

  return (
    <div className="flex flex-col gap-5">
      {views.length > 1 ? <Tabs view={view} views={views} /> : null}
      {view === "mine" ? (
        <MyContests rows={await contestPerformance(myIds, 10)} students={myIds.length} />
      ) : view === "colleges" ? (
        <Colleges />
      ) : view === "topk" ? (
        <TopKContests students={await listTopK(user)} seesAll={seesAllTopK(user)} poc={typeof params.poc === "string" ? params.poc : ""} db={db} ready={await topKReady()} />
      ) : view === "topics" ? (
        <TopicsView colleges={await idsByCollege()} myIds={myIds} />
      ) : (
        <ContestsList
          myIds={myIds}
          mine={myIds.length ? Object.fromEntries((await contestPerformance(myIds, 200)).map((r) => [r.slug, { handles: r.handles, tookPart: r.tookPart, avgSolved: r.avgSolved, bestRank: r.bestRank }])) : undefined}
        />
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
        actions={
          <Suspense fallback={null}>
            <ServicePill />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="h-[480px] rounded-xl" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
