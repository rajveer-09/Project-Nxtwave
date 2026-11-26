import Link from "next/link";
import { withParams, type SearchParamsRecord } from "@/common/lib/url";
import { isSupport, type Interaction } from "@nxtone/interactions-ui/lib/types";

type Row = { name: string; took: number; ownTook: number; supportTook: number; studentsGot: number; byOthers: number };

const n = (v: number) => v.toLocaleString("en-IN");

/**
 * Per person: interactions they took (for their own students / as support for another POC's), and
 * interactions their students got (from them / from a support POC). POC = the student's instructor
 * when the interaction was logged. `only` limits the rows to the people picked in the filters.
 */
export function PocSummary({ rows, params, only }: { rows: Interaction[]; params: SearchParamsRecord; only: string[] }) {
  const people = new Map<string, Row>();
  const get = (name: string) => {
    let r = people.get(name);
    if (!r) people.set(name, (r = { name, took: 0, ownTook: 0, supportTook: 0, studentsGot: 0, byOthers: 0 }));
    return r;
  };
  for (const it of rows) {
    const support = isSupport(it);
    const taker = get(it.takenBy);
    taker.took++;
    if (support) taker.supportTook++;
    else taker.ownTook++;
    if (it.pocAtTime) {
      const poc = get(it.pocAtTime);
      poc.studentsGot++;
      if (support) poc.byOthers++;
    }
  }
  const list = [...people.values()]
    .filter((r) => !only.length || only.includes(r.name))
    .sort((a, b) => b.took + b.studentsGot - (a.took + a.studentsGot) || a.name.localeCompare(b.name));

  if (!list.length) return <p className="px-5 pb-4 text-[13px] text-muted-foreground">No interactions in these dates.</p>;

  const link = (changes: Record<string, string | null>) => withParams("/interactions", params, changes);
  const cell = "border-b border-muted px-3 py-2 text-right tabular";
  return (
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
                  <Link href={link({ by: r.name, poc: null })} className="font-semibold text-primary hover:text-accent-strong" title={`Everything ${r.name} took`}>
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
                  <Link href={link({ poc: r.name, by: null })} className="font-semibold text-primary hover:text-accent-strong" title={`Everything ${r.name}'s students got`}>
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
  );
}
