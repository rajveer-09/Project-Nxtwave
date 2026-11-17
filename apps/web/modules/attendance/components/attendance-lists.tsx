/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { Skeleton } from "@/common/ui/skeleton";
import { attendanceApi } from "@/modules/attendance/api";
import { addDays, formatDate } from "@/common/lib/dates";

const th = "border-b border-border px-3 py-2.5 first:pl-4 last:pr-4";
const td = "border-b border-muted px-3 py-2.5 first:pl-4 last:pr-4";

export function TermsList() {
  const q = useQuery({ queryKey: ["attendance", "terms"], queryFn: attendanceApi.terms });
  if (q.isLoading) return <Skeleton className="h-40 rounded-xl" />;
  if (q.isError) return <EmptyState title="Couldn't load terms" description={q.error.message} />;
  return (
    <section aria-label="Terms" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <caption className="sr-only">Terms</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              <th scope="col" className={th}>Term</th>
              <th scope="col" className={th}>Starts</th>
              <th scope="col" className={th}>Ends</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...(q.data?.terms ?? [])].reverse().map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-semibold`}>{t.name}</td>
                <td className={td}>{formatDate(t.start)}</td>
                <td className={td}>{formatDate(t.end)}</td>
                <td className={td}>{t.is_current ? <StatusPill tone="accent">Current</StatusPill> : <StatusPill>{q.data && t.start > q.data.today ? "Upcoming" : "Past"}</StatusPill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Only days inside a term count for attendance. Terms can&apos;t overlap, and only one is current.</p>
    </section>
  );
}

const STATE_LABEL = { upcoming: "Upcoming", active: "In progress", ended: "Ended", pending: "Still pending", completed: "Completed", cancelled: "Cancelled" } as const;

export function InternshipsList({ today }: { today: string }) {
  const q = useQuery({
    queryKey: ["attendance", "internships", today],
    queryFn: () => attendanceApi.internships(addDays(today, -60), addDays(today, 60)),
  });
  if (q.isLoading) return <Skeleton className="h-60 rounded-xl" />;
  if (q.isError) return <EmptyState title="Couldn't load internships" description={q.error.message} />;
  const rows = q.data?.internships ?? [];
  return (
    <section aria-label="Internship and registration periods" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        {q.data?.current ?? 0} on internship today · {rows.length} periods in the last and next 60 days
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <caption className="sr-only">Internship and registration-pending periods</caption>
            <thead>
              <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                {["Student", "Group", "Kind", "Dates", "Attendance days", "Status"].map((h) => (
                  <th key={h} scope="col" className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <Link href={`/students/${p.niat_id}`} className="font-semibold hover:text-primary">
                      {p.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.niat_id}</div>
                  </td>
                  <td className={td}>
                    {p.degree} · {p.section} · {p.hall_no || "No hall"}
                  </td>
                  <td className={td}>{p.kind === "INTERNSHIP" ? "Internship (counts as present)" : "Registration pending (counts as absent)"}</td>
                  <td className={td}>
                    {formatDate(p.start)} – {formatDate(p.end)}
                  </td>
                  <td className={`${td} tabular`}>{p.attendance_days}</td>
                  <td className={td}>
                    <StatusPill tone={p.state === "active" ? "accent" : p.kind === "REGISTRATION_PENDING" ? "warning" : "neutral"}>{STATE_LABEL[p.state]}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <EmptyState title="No internship periods around today" />
        </div>
      )}
    </section>
  );
}
