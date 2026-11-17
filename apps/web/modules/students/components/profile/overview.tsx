/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/common/components/chips";
import { initials } from "@/common/auth/roles";
import type { StudentDetail } from "@/modules/students/data";
import { cn } from "@/common/lib/utils";

export function ProfileHeader({ d }: { d: StudentDetail }) {
  const s = d.student;
  const facts: [string, string][] = [
    ["Instructor", `${s.instructor} · since ${d.profile.instructorSince}`],
    ["POC", s.poc],
    ["Coach", d.profile.coach ?? "Not assigned"],
    ["LeetCode", s.lcHandle ? `${s.lcHandle} · verified` : "No handle"],
    ["Weekly test band", d.profile.levelBand],
    ["Last activity", d.profile.lastActivity],
  ];
  return (
    <section aria-label="Student profile" className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent font-heading text-[22px] font-semibold text-accent-strong">
            {initials(s.name)}
          </span>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h1 className="text-[28px] font-semibold">{s.name}</h1>
              <span className="text-sm text-muted-foreground tabular">{s.niatId}</span>
              <StatusPill tone="accent">Active</StatusPill>
            </div>
            <span className="text-[13px] text-sidebar-foreground">
              {s.college} · Section {s.section} · {s.hall} · Term 5 · joined 12 Aug 2026
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/messages" className="flex min-h-11 items-center rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-muted">
            Message instructor
          </Link>
          <Link
            href={`/interactions?student=${s.niatId}`}
            className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
          >
            Log interaction
          </Link>
        </div>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-5 gap-y-3 border-t border-muted pt-4 text-[13px]">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FlagsBanner({ d }: { d: StudentDetail }) {
  if (!d.flags.length) {
    return (
      <p className="rounded-xl border border-accent-border bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
        On track · no warning signs across attendance, interactions, weekly tests and contests.
      </p>
    );
  }
  return (
    <div role="note" className="flex flex-wrap items-start gap-x-5 gap-y-3 rounded-xl border border-warning-border bg-warning-soft px-4 py-3.5 text-[#6E3005]">
      <span className="flex items-center gap-2.5 font-bold">
        <TriangleAlert aria-hidden="true" className="size-5" />
        Needs attention · {d.flags.length} flag{d.flags.length === 1 ? "" : "s"}
      </span>
      <ul className="flex flex-[1_1_400px] flex-wrap gap-1.5">
        {d.flags.map((flag) => (
          <li key={flag.key} className="rounded-full bg-card px-2.5 py-0.5 text-xs font-semibold">
            {flag.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Snapshot({ d }: { d: StudentDetail }) {
  const s = d.snapshot;
  const tiles = [
    { label: "Attendance", value: `${s.attendance30d}%`, sub: `Last 30 days · term ${s.attendanceTerm}%`, warn: s.attendance30d < 75 },
    { label: "DSA level", value: `L${s.level}`, sub: `Step ${s.step} · ${s.weeksAtLevel} weeks at this level`, warn: false },
    { label: "Interactions", value: String(s.interactions), sub: s.lastInteraction ? `Last ${s.lastInteraction} · avg ${s.avgRating} / 5` : "None yet", warn: false },
    { label: "Weekly tests", value: `${s.latestTest} / ${d.tests.max}`, sub: `Latest · avg ${s.testAvg} over ${d.tests.list.length} tests`, warn: s.latestTest < d.tests.passMark },
    { label: "LeetCode", value: s.rating ? s.rating.toLocaleString("en-IN") : "—", sub: s.rating ? `Rating · ${s.contestsAttended} of 12 contests` : "No handle on file", warn: false },
  ];
  return (
    <section aria-label="Snapshot" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.label}</span>
          <span className={cn("font-heading text-[26px] font-semibold tabular", t.warn && "text-warning")}>{t.value}</span>
          <span className="text-xs text-muted-foreground">{t.sub}</span>
        </div>
      ))}
    </section>
  );
}

const SECTIONS = [
  ["attendance", "Attendance"],
  ["progress", "DSA progress"],
  ["interactions", "Interactions"],
  ["tests", "Weekly tests"],
  ["contests", "Contests"],
  ["records", "Records & history"],
  ["timeline", "Activity timeline"],
] as const;

export function JumpBar() {
  return (
    <nav aria-label="Sections on this page" className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-2">
      {SECTIONS.map(([id, label]) => (
        <a key={id} href={`#${id}`} className="flex min-h-10 items-center rounded-lg bg-background px-3.5 text-[13px] font-semibold hover:bg-muted">
          {label}
        </a>
      ))}
    </nav>
  );
}

export function SectionHeading({ id, title, extra, link }: { id: string; title: string; extra?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={`${id}-h`} className="text-[22px] font-semibold">
        {title}
        {extra ? <span className="ml-2 text-[15px] font-medium text-muted-foreground">{extra}</span> : null}
      </h2>
      {link ? (
        <Link href={link.href} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
          {link.label} →
        </Link>
      ) : null}
    </div>
  );
}
