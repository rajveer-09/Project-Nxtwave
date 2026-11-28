/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { STANDING_HINT, STANDING_LABEL, STANDINGS, type Standing } from "@/common/domain/standing";
import { cn } from "@/common/lib/utils";
import type { StandingSummary } from "@/modules/home/data";

const DOT: Record<Standing, string> = {
  pending: "bg-muted-foreground/60",
  in_progress: "bg-chart-4",
  revisit: "bg-destructive",
  cleared: "bg-primary",
};

const studentsHref = (filters: { level?: number; standing?: Standing }) => {
  const params = new URLSearchParams();
  if (filters.level !== undefined) params.set("level", String(filters.level));
  if (filters.standing) params.set("standing", filters.standing);
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
};

/** A count that opens the Students page filtered to those students; zero is plain text. */
function CountLink({ value, href, label, strong }: { value: number; href: string; label: string; strong?: boolean }) {
  if (value === 0) return <span className="block px-2 py-1 text-right text-muted-foreground/60 tabular">0</span>;
  return (
    <Link
      href={href}
      aria-label={`${value} ${label}`}
      className={cn(
        "block rounded-md px-2 py-1 text-right tabular hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        strong ? "font-semibold text-foreground" : "text-sidebar-foreground",
      )}
    >
      {value}
    </Link>
  );
}

/**
 * Where every student stands at their current level: totals per standing, then a level × standing
 * table. Each number opens the matching students.
 */
export function StandingOverview({ summary }: { summary: StandingSummary }) {
  const levels = summary.byLevel.filter((row) => row.total > 0 || row.level <= 4);
  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <li>
          <Link href={studentsHref({})} className="flex h-full flex-col gap-1 rounded-lg border border-border px-3 py-2.5 hover:bg-muted">
            <span className="text-xs font-medium text-muted-foreground">Students</span>
            <span className="font-heading text-2xl font-semibold tabular">{summary.total}</span>
            <span className="text-xs text-muted-foreground">Across all levels</span>
          </Link>
        </li>
        {STANDINGS.map((standing) => (
          <li key={standing}>
            <Link href={studentsHref({ standing })} className="flex h-full flex-col gap-1 rounded-lg border border-border px-3 py-2.5 hover:bg-muted">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[standing])} />
                {STANDING_LABEL[standing]}
              </span>
              <span className="font-heading text-2xl font-semibold tabular">{summary.counts[standing]}</span>
              <span className="text-xs text-muted-foreground">{STANDING_HINT[standing]}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <caption className="sr-only">Students per level and standing at that level</caption>
          <thead>
            <tr className="bg-surface-subtle text-xs text-muted-foreground">
              <th scope="col" className="border-b border-border px-3 py-2.5 text-left font-semibold">Level</th>
              <th scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">Students</th>
              {STANDINGS.map((standing) => (
                <th key={standing} scope="col" className="border-b border-border px-3 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn("size-2 rounded-full", DOT[standing])} />
                    {STANDING_LABEL[standing]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((row) => (
              <tr key={row.level} className={row.total === 0 ? "opacity-60" : undefined}>
                <th scope="row" className="border-b border-muted px-3 py-1 text-left font-medium">
                  Level {row.level}
                </th>
                <td className="border-b border-muted px-1 py-1">
                  <CountLink value={row.total} href={studentsHref({ level: row.level })} label={`students at Level ${row.level}`} strong />
                </td>
                {STANDINGS.map((standing) => (
                  <td key={standing} className="border-b border-muted px-1 py-1">
                    <CountLink
                      value={row.counts[standing]}
                      href={studentsHref({ level: row.level, standing })}
                      label={`students at Level ${row.level}, ${STANDING_LABEL[standing].toLowerCase()}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Standing comes from the latest interaction logged at the student&apos;s current level. A student who has just moved up shows as not interacted yet
        until they&apos;re evaluated at the new level.
      </p>
    </div>
  );
}
