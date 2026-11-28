/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { StatusPill } from "@/common/components/chips";
import { IntentLink } from "@/common/components/intent-link";
import { Pager, usePages } from "@/common/components/pager";
import { searchMatcher } from "@/common/lib/search";
import { useState } from "react";

/** One row of the Recent interactions table, only what it shows (RecentLogs builds these). */
export type RecentRow = {
  id: string;
  date: string;
  /** YYYY-MM-DD, for the date filter. */
  ymd: string;
  niatId: string;
  studentName: string;
  round: number;
  takenBy: string;
  /** The POC whose student this was, when someone else took it as support. */
  supportFor: string | null;
  covered: string;
  questions: number;
  offRoadmap: number;
  status: string;
  tone: "accent" | "warning" | "danger" | "neutral";
  rating: number;
  codeRoom: string | null;
};

const PAGE = 10;

/** The table, ten rows a page with ‹ › (newest first), with its own search and date filter. */
/**
 * `actions`: per row id, what to show at the end of the row (the page passes its Inspect button).
 * `linkStudents`: the student's name opens their profile (super admins, admins, senior instructors).
 */
export function RecentLogsTable({ rows, actions = {}, linkStudents = false }: { rows: RecentRow[]; actions?: Record<string, React.ReactNode>; linkStudents?: boolean }) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [outcome, setOutcome] = useState("");
  const match = searchMatcher(q);
  const shown = rows.filter((it) => (!day || it.ymd === day) && (!outcome || it.status === outcome) && match(it.studentName, it.niatId, it.covered, it.takenBy, it.supportFor));
  const pg = usePages(shown, PAGE);
  const days = [...new Map(rows.map((r) => [r.ymd, r.date])).entries()];
  const outcomes = [...new Set(rows.map((r) => r.status))];
  const field = "h-9 rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
  const filtering = !!(q.trim() || day || outcome);
  return (
    <>
      <div role="search" aria-label="Filter recent interactions" className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            pg.go(0);
          }}
          placeholder="Search student, NIAT ID, topic or instructor"
          aria-label="Search recent interactions"
          className={`${field} w-full sm:w-72`}
        />
        <select
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            pg.go(0);
          }}
          aria-label="Date"
          className={field}
        >
          <option value="">All dates</option>
          {days.map(([ymd, label]) => (
            <option key={ymd} value={ymd}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value);
            pg.go(0);
          }}
          aria-label="Outcome"
          className={field}
        >
          <option value="">Any outcome</option>
          {outcomes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {filtering ? (
          <>
            <span className="text-xs text-muted-foreground tabular">
              {shown.length} of {rows.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setQ("");
                setDay("");
                setOutcome("");
                pg.go(0);
              }}
              className="text-xs font-semibold text-primary hover:text-accent-strong"
            >
              Clear
            </button>
          </>
        ) : null}
      </div>
      {!shown.length ? <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No interactions match these filters.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <caption className="sr-only">Recent interactions</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              {["Date", "Student", "Covered", "Questions", "Outcome", "Rating"].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-2.5 py-2.5 first:pl-5">
                  {h}
                </th>
              ))}
              <th scope="col" className="border-b border-border py-2.5 pr-5 pl-2.5">
                <span className="sr-only">Inspect</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((it) => (
              <tr key={it.id}>
                <td className="border-b border-muted py-2.5 pr-2.5 pl-5 whitespace-nowrap text-sidebar-foreground">{it.date}</td>
                <td className="border-b border-muted px-2.5 py-2.5">
                  {linkStudents ? (
                    <IntentLink href={`/students/${it.niatId}`} className="font-semibold hover:text-primary hover:underline">
                      {it.studentName}
                    </IntentLink>
                  ) : (
                    <div className="font-semibold">{it.studentName}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    round {it.round} · {it.takenBy}
                  </div>
                  {it.supportFor ? (
                    <span
                      className="mt-1 inline-block max-w-full truncate rounded-md bg-warning-soft px-1.5 py-px align-top text-[11px] font-semibold text-warning"
                      title={`${it.takenBy} took it for ${it.supportFor}'s student`}
                    >
                      Support for {it.supportFor}
                    </span>
                  ) : null}
                </td>
                <td className="border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">{it.covered}</td>
                <td className="border-b border-muted px-2.5 py-2.5 text-sidebar-foreground">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="tabular">{it.questions}</span>
                    {it.offRoadmap ? <span className="rounded-md bg-warning-soft px-1.5 text-xs font-semibold whitespace-nowrap text-warning">{it.offRoadmap} off-roadmap</span> : null}
                    {it.codeRoom ? <span className="text-xs whitespace-nowrap text-muted-foreground">· code saved</span> : null}
                  </span>
                </td>
                <td className="border-b border-muted px-2.5 py-2.5 whitespace-nowrap">
                  <StatusPill tone={it.tone}>{it.status}</StatusPill>
                </td>
                <td className="border-b border-muted px-2.5 py-2.5 font-semibold whitespace-nowrap tabular">{it.rating} / 5</td>
                <td className="border-b border-muted py-2.5 pr-5 pl-2.5 text-right">
                  {actions[it.id] ?? null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} label="Recent interaction pages" prevLabel="Newer interactions" nextLabel="Older interactions" className="px-5 py-3" />
    </>
  );
}
