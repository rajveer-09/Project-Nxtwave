/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { BarList } from "@/common/components/bar-list";
import type { StudentDetail } from "@/modules/students/data";
import { cn } from "@/common/lib/utils";
import { InteractionsList } from "@/modules/students/components/profile/interactions-list";
import { SectionHeading } from "@/modules/students/components/profile/overview";
import { TestsChart } from "@/modules/students/components/profile/tests-chart";
import { Timeline } from "@/modules/students/components/profile/timeline";

export function InteractionsSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  return (
    <section id="interactions" aria-labelledby="interactions-h" className="flex scroll-mt-6 flex-col gap-3">
      <SectionHeading
        id="interactions"
        title="Interactions"
        extra={`· ${d.snapshot.interactions} rounds${d.snapshot.avgRating !== null ? ` · avg rating ${d.snapshot.avgRating}` : ""}`}
        link={student ? undefined : { href: `/interactions?student=${d.student.niatId}`, label: "Log a new one" }}
      />
      <InteractionsList
        student={student}
        items={student ? d.interactions.map((it) => ({ ...it, transcriptWords: 0 })) : d.interactions}
      />
    </section>
  );
}

export function TestsSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const t = d.tests;
  const maxArea = Math.max(1, ...t.recurringAreas.map((a) => a.count));
  return (
    <section id="tests" aria-labelledby="tests-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="tests" title="Weekly tests" link={student ? undefined : { href: "/tests", label: "Weekly tests" }} />
      {!t.list.length ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">{student ? "No weekly test results yet." : "No weekly test results recorded for this student yet."}</p>
      ) : (
      <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_380px] rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold">Score vs class average</h3>
            <span className="text-xs text-muted-foreground">out of {t.max} · pass {t.passMark}</span>
          </div>
          <TestsChart data={t.list.map((x) => ({ key: x.key, score: x.total, classAvg: x.classAvg }))} passMark={t.passMark} max={t.max} />
          <p className="sr-only">
            {t.list.map((x) => `${x.name}: ${x.total} of ${t.max}, class average ${x.classAvg}`).join(". ")}
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_300px] rounded-xl border border-border bg-card p-4">
          <h3 className="text-[15px] font-bold">Recurring improvement areas</h3>
          <p className="mb-3 text-xs text-muted-foreground">Across weekly tests</p>
          {t.recurringAreas.length ? (
            <BarList
              items={t.recurringAreas.map((a) => ({ label: a.name, value: a.count, display: `${a.count}×`, warn: true }))}
              max={maxArea}
              labelWidth="8.5rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <caption className="sr-only">Weekly test results</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["Test", ...t.markLabels, "Total", "Improvement areas", "Remarks", "Next step"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-2.5 py-2.5 first:pl-4 last:pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...t.list].reverse().map((x) => (
                <tr key={x.key}>
                  <td className="border-b border-muted py-2.5 pr-2.5 pl-4">
                    <span className="font-semibold">{x.name}</span>
                    <div className="text-xs text-muted-foreground">
                      {x.date} · {x.by}
                    </div>
                  </td>
                  {x.marks.map((m, i) => (
                    <td key={i} className="border-b border-muted px-2.5 py-2.5 tabular">
                      {m}
                    </td>
                  ))}
                  <td className={cn("border-b border-muted px-2.5 py-2.5 font-bold tabular", x.belowPass && "text-warning")}>
                    {x.total} / {t.max}
                  </td>
                  <td className="border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">{x.areas.join(", ") || "—"}</td>
                  <td className="max-w-72 border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">{x.remarks}</td>
                  <td className="border-b border-muted py-2.5 pr-4 pl-2.5 text-sidebar-foreground">{x.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </section>
  );
}

export function ContestsSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const c = d.contests;
  const stats: [string, string, boolean][] = [
    ["Rating", c.rating ? c.rating.toLocaleString("en-IN") : "—", false],
    ["Attended", `${c.attended} of ${c.of}`, false],
    ["Absent streak", c.absentStreak ? `${c.absentStreak} contests` : "None", c.absentStreak >= 3],
    ["Best global rank", c.bestGlobal ? c.bestGlobal.toLocaleString("en-IN") : "—", false],
    ["Best college rank", c.bestCollege ? `#${c.bestCollege}` : "—", false],
    ["Avg solved", c.avgSolved !== null ? `${c.avgSolved.toFixed(1)} / 4` : "—", false],
  ];
  return (
    <section id="contests" aria-labelledby="contests-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="contests" title="LeetCode contests" extra={c.handle ? `· ${c.handle}` : "· no handle on file"} link={student ? undefined : { href: "/contests", label: "All contests" }} />
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {stats.map(([label, value, warn]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-3.5 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className={cn("font-heading text-xl font-semibold tabular", warn && "text-warning")}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[2_1_480px] overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <caption className="sr-only">Recent contests</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  {["Contest", "Status", "Solved", "Global", "College"].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-2.5 py-2.5 first:pl-4 last:pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.results.map((r) => (
                  <tr key={r.name}>
                    <td className="border-b border-muted py-2.5 pr-2.5 pl-4">
                      <span className="font-semibold">{r.name}</span>
                      <div className="text-xs text-muted-foreground">{r.date}</div>
                    </td>
                    <td className={cn("border-b border-muted px-2.5 py-2.5 font-semibold", r.attended ? "text-accent-strong" : "text-warning")}>
                      {r.attended ? "Attended" : "Absent"}
                    </td>
                    <td className="border-b border-muted px-2.5 py-2.5 tabular">{r.solved !== null ? `${r.solved} / 4` : "—"}</td>
                    <td className="border-b border-muted px-2.5 py-2.5 tabular">{r.globalRank?.toLocaleString("en-IN") ?? "—"}</td>
                    <td className="border-b border-muted py-2.5 pr-4 pl-2.5 tabular">{r.collegeRank ? `#${r.collegeRank}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_280px] rounded-xl border border-border bg-card p-4">
          <h3 className="text-[15px] font-bold">Topics in contest problems</h3>
          <p className="mb-3 text-xs text-muted-foreground">Solved / attempted, from LeetCode tags</p>
          {!c.tags.length ? <p className="text-sm text-muted-foreground">No contest problems attempted yet.</p> : null}
          <BarList
            items={c.tags.map((tag) => ({
              label: tag.name,
              value: tag.attempted ? tag.solved / tag.attempted : 0,
              display: `${tag.solved}/${tag.attempted}`,
              warn: tag.attempted > 0 && tag.solved / tag.attempted < 0.5,
            }))}
            max={1}
            labelWidth="7.5rem"
          />
        </div>
      </div>
    </section>
  );
}

export function RecordsSection({ d }: { d: StudentDetail }) {
  const r = d.records;
  return (
    <section id="records" aria-labelledby="records-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="records" title="Records & history" />
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_360px] rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-[15px] font-bold">Roster details</h3>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
            {r.roster.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-[15px] font-bold">Instructor & mentor assignments</h3>
            <ul>
              {r.assignments.map((a) => (
                <li key={`${a.who}-${a.when}`} className="flex justify-between gap-2.5 border-b border-muted py-2 text-[13px] last:border-b-0">
                  <span>
                    <span className="font-semibold">{a.who}</span> <span className="text-muted-foreground">· {a.role}</span>
                  </span>
                  <span className="text-sidebar-foreground">{a.when}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-[15px] font-bold">Change log</h3>
            <ul>
              {r.changeLog.map((c) => (
                <li key={c.what} className="flex justify-between gap-2.5 border-b border-muted py-2 text-[13px] last:border-b-0">
                  <span>{c.what}</span>
                  <span className="whitespace-nowrap text-muted-foreground">{c.when}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TimelineSection({ d }: { d: StudentDetail }) {
  return (
    <section id="timeline" aria-labelledby="timeline-h" className="flex scroll-mt-6 flex-col gap-3">
      <SectionHeading id="timeline" title="Activity timeline" />
      <Timeline events={d.timeline} />
    </section>
  );
}
