/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import type { ChangeEntry } from "@/modules/admin/change-log-data";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Change log rows: when, what, who it was about, before → after, who made it and from where. */
export function ChangeTable({ entries, showSubject = true }: { entries: ChangeEntry[]; showSubject?: boolean }) {
  if (!entries.length) return <p className="px-5 py-4 text-sm text-muted-foreground">No changes recorded yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[13px]">
        <caption className="sr-only">Change log</caption>
        <thead>
          <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">When</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Change</th>
            {showSubject ? <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">For</th> : null}
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Before → after</th>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold">Made by</th>
            <th scope="col" className="border-b border-border px-5 py-2.5 font-semibold">From</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="border-b border-muted px-5 py-2.5 whitespace-nowrap text-sidebar-foreground">{when(e.at)}</td>
              <td className="border-b border-muted px-3 py-2.5 font-semibold">{e.what}</td>
              {showSubject ? (
                <td className="border-b border-muted px-3 py-2.5">
                  {e.subject?.kind === "student" ? (
                    <Link href={`/students/${e.subject.niatId}`} className="font-medium hover:text-primary">
                      {e.subject.name}
                      <span className="ml-1.5 text-xs text-muted-foreground tabular">{e.subject.niatId}</span>
                    </Link>
                  ) : (
                    (e.subject?.name ?? "—")
                  )}
                </td>
              ) : null}
              <td className="border-b border-muted px-3 py-2.5">
                {e.before === null && e.after === null ? (
                  "—"
                ) : (
                  <>
                    <span className="text-muted-foreground">{e.before ?? "none"}</span>
                    <span aria-label="changed to" className="px-1.5 text-muted-foreground">→</span>
                    <span className="font-medium">{e.after ?? "none"}</span>
                  </>
                )}
              </td>
              <td className="border-b border-muted px-3 py-2.5">
                <span className="font-medium">{e.by}</span>
                {e.byRole ? <span className="text-xs text-muted-foreground"> · {e.byRole}</span> : null}
              </td>
              <td className="border-b border-muted px-5 py-2.5 text-sidebar-foreground">
                {e.source}
                {e.sourceDetail ? <div className="max-w-56 truncate text-xs text-muted-foreground" title={e.sourceDetail}>{e.sourceDetail}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
