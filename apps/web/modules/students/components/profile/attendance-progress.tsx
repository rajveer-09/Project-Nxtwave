/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { CalendarMonth } from "@/common/components/calendar-month";
import type { StudentDetail } from "@/modules/students/data";
import { cn } from "@/common/lib/utils";
import { SectionHeading } from "@/modules/students/components/profile/overview";

export function AttendanceSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const a = d.attendance;
  return (
    <section id="attendance" aria-labelledby="attendance-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="attendance" title="Attendance" link={student ? undefined : { href: "/attendance", label: "Open attendance sheet" }} />
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_380px] rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold">{a.monthLabel}</h3>
            <span className="text-[13px] text-muted-foreground">
              {a.present} present · {a.absent} absent · {a.pct}%
            </span>
          </div>
          <CalendarMonth label={`${a.monthLabel} attendance`} cells={a.calendar} />
        </div>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[13px]">
                <caption className="sr-only">Attendance by month</caption>
                <thead>
                  <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                    <th scope="col" className="border-b border-border px-4 py-2.5">Month</th>
                    <th scope="col" className="border-b border-border px-2 py-2.5">Days</th>
                    <th scope="col" className="border-b border-border px-2 py-2.5">P / A</th>
                    <th scope="col" className="border-b border-border px-2 py-2.5">%</th>
                    <th scope="col" className="border-b border-border px-4 py-2.5">Monthly remark</th>
                  </tr>
                </thead>
                <tbody>
                  {a.months.map((m) => (
                    <tr key={m.month}>
                      <td className="border-b border-muted px-4 py-2.5 font-semibold">{m.month}</td>
                      <td className="border-b border-muted px-2 py-2.5 tabular">{m.workingDays}</td>
                      <td className="border-b border-muted px-2 py-2.5 tabular">{m.present} / {m.absent}</td>
                      <td className={cn("border-b border-muted px-2 py-2.5 font-bold tabular", m.pct < 75 && "text-warning")}>{m.pct}%</td>
                      <td className="border-b border-muted px-4 py-2.5 text-sidebar-foreground">{m.remark ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <div className="rounded-xl border border-border bg-card px-4 py-3.5">
              <dt className="text-xs font-semibold text-muted-foreground">To reach 75% (30-day)</dt>
              <dd className="mt-1 font-bold">{a.daysTo75 ? `${a.daysTo75} straight present days` : "Already above 75%"}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3.5">
              <dt className="text-xs font-semibold text-muted-foreground">Placement target (95% of term)</dt>
              <dd className={cn("mt-1 font-bold", !a.placementReachable && "text-warning")}>
                {a.placementReachable ? "Still reachable" : "Not reachable this term"}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3.5">
              <dt className="text-xs font-semibold text-muted-foreground">Internship / registration periods</dt>
              <dd className="mt-1 font-bold">{a.periods.length ? a.periods.map((p) => p.kind).join(", ") : "None recorded"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const LEVEL_BAR = { cleared: "bg-primary", current: "bg-accent-border ring-1 ring-primary", future: "bg-muted" } as const;
const SUB_STYLE = { done: "bg-accent text-accent-strong", now: "bg-foreground text-background", todo: "bg-muted text-muted-foreground" } as const;
const TOPIC_STATE = {
  cleared: ["Cleared", "text-accent-strong", "border-border bg-card"],
  current: ["In progress", "text-warning", "border-warning-border bg-[#FFFAF6] dark:bg-[#24180F]"],
  "not-started": ["Not started", "text-muted-foreground", "border-border bg-card"],
} as const;

export function ProgressSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const p = d.progress;
  return (
    <section id="progress" aria-labelledby="progress-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="progress" title="DSA progress" link={student ? undefined : { href: "/admin/curriculum", label: "View roadmap" }} />
      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
        <ol aria-label="Levels" className="grid grid-cols-8 gap-1.5">
          {p.levels.map((l) => (
            <li key={l.level} className="flex flex-col items-center gap-1.5">
              <span className={cn("h-2.5 w-full rounded-full", LEVEL_BAR[l.state as keyof typeof LEVEL_BAR])} aria-hidden="true" />
              <span className={cn("text-xs font-bold", l.state === "future" ? "text-muted-foreground" : "text-foreground")}>L{l.level}</span>
              <span className="text-[11px] text-muted-foreground">{l.state === "cleared" ? "Cleared" : l.state === "current" ? "Current" : ""}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-5">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
            <h3 className="text-[15px] font-bold">Level {p.level} topics</h3>
            {p.topics.map((t) => {
              const [label, tone, box] = TOPIC_STATE[t.state as keyof typeof TOPIC_STATE];
              return (
                <div key={t.name} className={cn("flex flex-col gap-1.5 rounded-lg border px-3 py-2.5", box)}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <span className={cn("text-xs font-bold", tone)}>{label}</span>
                  </div>
                  {t.subtopics.length ? (
                    <ul className="flex flex-wrap gap-1">
                      {t.subtopics.map((sub) => (
                        <li key={sub.name} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", SUB_STYLE[sub.state as keyof typeof SUB_STYLE])}>
                          {sub.name}
                          {sub.state === "now" ? <span className="sr-only"> (current)</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold">
                Current: {p.topic}
                {p.subtopic ? ` › ${p.subtopic}` : ""}
              </h3>
              <ol aria-label="Steps" className="flex flex-wrap gap-1.5">
                {p.steps.map((step) => (
                  <li
                    key={step.code}
                    className={cn(
                      "flex min-w-16 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold",
                      step.state === "done" && "border-accent bg-accent text-accent-strong",
                      step.state === "now" && "border-foreground bg-foreground text-background",
                      step.state === "todo" && "border-border bg-card text-[#6B7080] dark:text-[#A3A9B7]",
                    )}
                  >
                    <span className="text-[13px] font-bold">{step.code}</span>
                    {step.label}
                    {step.state === "now" ? <span className="sr-only"> (current step)</span> : null}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold">Level history</h3>
              <ol className="flex flex-col gap-2.5">
                {p.levelHistory.map((h, i) => (
                  <li key={h.change} className="flex gap-2.5">
                    <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-[#C9CCD4] dark:bg-[#4A505E]")} aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{h.change}</span>{" "}
                      <span className="text-[13px] text-muted-foreground">
                        · {h.date} · {h.by}
                        {i === 0 && p.weeksAtLevel ? ` · ${p.weeksAtLevel} weeks at this level` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold">Questions asked so far</h3>
              <ul className="flex flex-col gap-1.5">
                {p.questions.map((q) => (
                  <li key={q.title} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-px text-[11px] font-bold",
                        q.offRoadmap ? "bg-warning-soft text-warning" : "bg-accent text-accent-strong",
                      )}
                    >
                      {q.tag}
                    </span>
                    <span className="font-semibold">{q.title}</span>
                    <span className="text-muted-foreground">· {q.result}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
