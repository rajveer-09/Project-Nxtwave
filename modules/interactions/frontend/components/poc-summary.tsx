"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useResetWhenShown } from "@/common/lib/use-reset-when-shown";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";

/** One interaction, reduced to what the By person table counts. poc = the student's instructor when it was logged. */
export type PersonRow = { date: string; takenBy: string; poc: string };

type Row = { name: string; took: number; ownTook: number; supportTook: number; studentsGot: number; byOthers: number };

const n = (v: number) => v.toLocaleString("en-IN");
const field =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Per person: interactions they took (for their own students / as support for another POC's), and
 * interactions their students got (from them / from a support POC). Its own From–To (starting from,
 * and following, the page's dates) and a name search filter it right here, without reloading.
 * Clicking a number filters the whole page to that person.
 */
export function PocSummary({ rows, from: pageFrom, to: pageTo, today, params }: { rows: PersonRow[]; from: string; to: string; today: string; params: SearchParamsRecord }) {
  const [from, setFrom] = useState(pageFrom);
  const [to, setTo] = useState(pageTo);
  const [name, setName] = useState("");
  useResetWhenShown(() => {
    setFrom(pageFrom);
    setTo(pageTo);
  }, `${pageFrom}|${pageTo}`);

  const people = new Map<string, Row>();
  const get = (who: string) => {
    let r = people.get(who);
    if (!r) people.set(who, (r = { name: who, took: 0, ownTook: 0, supportTook: 0, studentsGot: 0, byOthers: 0 }));
    return r;
  };
  for (const it of rows) {
    if ((from && it.date < from) || (to && it.date > to)) continue;
    const support = !!it.poc && it.takenBy !== it.poc;
    const taker = get(it.takenBy);
    taker.took++;
    if (support) taker.supportTook++;
    else taker.ownTook++;
    if (it.poc) {
      const poc = get(it.poc);
      poc.studentsGot++;
      if (support) poc.byOthers++;
    }
  }
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = [...people.values()]
    .filter((r) => words.every((w) => r.name.toLowerCase().includes(w)))
    .sort((a, b) => b.took + b.studentsGot - (a.took + a.studentsGot) || a.name.localeCompare(b.name));

  const link = (changes: Record<string, string | null>) => withParams("/interactions", params, changes);
  const cell = "border-b border-muted px-3 py-2 text-right tabular";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 px-5">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search person
          <span className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={name} onChange={(e) => setName(e.target.value)} placeholder="Instructor or POC name" className={`${field} w-full pl-8`} />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From
          <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          To
          <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        {from !== pageFrom || to !== pageTo || name ? (
          <button
            type="button"
            onClick={() => {
              setFrom(pageFrom);
              setTo(pageTo);
              setName("");
            }}
            className="flex h-9 items-center px-1 text-sm font-semibold text-primary hover:text-accent-strong"
          >
            Reset
          </button>
        ) : null}
      </div>

      {list.length ? (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <caption className="sr-only">Interactions per person: taken by them, and taken for their students</caption>
            {/* Each header cell gets the background: with border-collapse, the sticky <thead>'s own background doesn't cover scrolled rows. */}
            <thead className="sticky top-0 z-10 text-xs text-muted-foreground [&_th]:bg-surface-subtle">
              <tr>
                <th scope="col" rowSpan={2} className="border-b border-border py-2 pr-3 pl-5 text-left align-bottom font-semibold">Person</th>
                <th scope="colgroup" colSpan={3} className="border-b border-l border-border px-3 pt-2 pb-1 text-center font-semibold">Took</th>
                <th scope="colgroup" colSpan={2} className="border-b border-l border-border px-3 pt-2 pb-1 pr-5 text-center font-semibold">Their students got (as POC)</th>
              </tr>
              <tr>
                <th scope="col" className="border-b border-l border-border px-3 py-1.5 text-right font-semibold">Total</th>
                <th scope="col" className="border-b border-border px-3 py-1.5 text-right font-semibold">Own students</th>
                <th scope="col" className="border-b border-border px-3 py-1.5 text-right font-semibold">As support</th>
                <th scope="col" className="border-b border-l border-border px-3 py-1.5 text-right font-semibold">Total</th>
                <th scope="col" className="border-b border-border py-1.5 pr-5 pl-3 text-right font-semibold">Taken by support</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.name}>
                  <th scope="row" className="border-b border-muted py-2 pr-3 pl-5 text-left font-semibold">{r.name}</th>
                  <td className={`${cell} border-l border-l-border`}>
                    {r.took ? (
                      <Link href={link({ by: r.name, poc: null, from, to })} className="font-semibold text-primary hover:text-accent-strong" title={`Everything ${r.name} took`}>
                        {n(r.took)}
                      </Link>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className={cell}>{n(r.ownTook)}</td>
                  <td className={cell}>{r.supportTook ? <span className="font-semibold text-warning">{n(r.supportTook)}</span> : "0"}</td>
                  <td className={`${cell} border-l border-l-border`}>
                    {r.studentsGot ? (
                      <Link href={link({ poc: r.name, by: null, from, to })} className="font-semibold text-primary hover:text-accent-strong" title={`Everything ${r.name}'s students got`}>
                        {n(r.studentsGot)}
                      </Link>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className={`${cell} pr-5`}>{r.byOthers ? <span className="font-semibold text-warning">{n(r.byOthers)}</span> : "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-4 text-[13px] text-muted-foreground">{words.length ? `No one matching “${name.trim()}” in these dates.` : "No interactions in these dates."}</p>
      )}
    </div>
  );
}
