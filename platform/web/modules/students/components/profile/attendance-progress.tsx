/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { CalendarMonth } from "@/common/components/calendar-month";
import type { StudentDetail } from "@/modules/students/data";
import type { StudentPeriodView } from "@/common/sample-data/student-detail";
import { cn } from "@/common/lib/utils";
import { SectionHeading } from "@/modules/students/components/profile/overview";
import { ProgressExplorer } from "@/modules/students/components/profile/progress-explorer";
import { basicExplore } from "@/common/domain/progress-explore";

export function AttendanceSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const a = d.attendance;
  return (
    <section id="attendance" aria-labelledby="attendance-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="attendance" title="DSA attendance" link={student ? undefined : { href: "/attendance", label: "Open attendance sheet" }} />
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
                <caption className="sr-only">DSA attendance by month</caption>
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
          </dl>
          {a.periods.length ? <PeriodsCard periods={a.periods} /> : null}
        </div>
      </div>
    </section>
  );
}


const PERIOD_KIND = {
  Internship: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300",
  "Registration pending": "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
} as const;
const PERIOD_STATE: Record<StudentPeriodView["state"], string> = {
  upcoming: "Upcoming",
  active: "In progress",
  ended: "Ended",
  pending: "Still pending",
  completed: "Completed",
};
const periodDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Read-only internship and registration-pending periods (cancelled ones are never shown). */
function PeriodsCard({ periods }: { periods: StudentPeriodView[] }) {
  return (
    <section aria-labelledby="att-periods-h" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 id="att-periods-h" className="text-[15px] font-bold">
          Internship and registration
        </h3>
        <p className="text-[13px] text-muted-foreground">Internship days count as Present; days with Term 5 registration pending count as Absent.</p>
      </div>
      <ul className="flex flex-col gap-2 text-[13px]">
        {periods.map((p) => (
          <li key={`${p.kind}${p.from}`} className="flex flex-col gap-1 rounded-lg border border-border p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", PERIOD_KIND[p.kind])}>{p.kind}</span>
              <span className="text-xs font-semibold">{PERIOD_STATE[p.state]}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {periodDate(p.from)} – {periodDate(p.to)} · {p.calendarDays} day{p.calendarDays === 1 ? "" : "s"} ({p.attendanceDays} attendance day
              {p.attendanceDays === 1 ? "" : "s"})
              {p.kind === "Registration pending"
                ? p.completedOn
                  ? ` · registration completed by ${periodDate(p.completedOn)}`
                  : ` · not completed yet (last seen pending ${periodDate(p.to)})`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgressSection({ d, student = false }: { d: StudentDetail; student?: boolean }) {
  const p = d.progress;
  const history = (
    <div className="flex flex-col gap-2">
      <h3 className="text-[15px] font-bold">Level history</h3>
      <ol className="flex flex-col gap-2.5">
        {p.levelHistory.map((h, i) => (
          <li key={h.change} className="flex gap-2.5">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", i === 0 ? "bg-chart-4" : "bg-[#C9CCD4] dark:bg-[#4A505E]")} aria-hidden="true" />
            <span>
              <span className="font-semibold">{h.change}</span> <span className="text-[13px] text-muted-foreground">· {h.date}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <section id="progress" aria-labelledby="progress-h" className="flex scroll-mt-6 flex-col gap-3.5">
      <SectionHeading id="progress" title="DSA progress" link={student ? undefined : { href: "/admin/curriculum", label: "View roadmap" }} />
      <div className="rounded-xl border border-border bg-card p-4">
        <ProgressExplorer data={p.explore ?? basicExplore(p)} history={history} />
      </div>
    </section>
  );
}
