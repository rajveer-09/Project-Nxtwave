import { StatusPill } from "@/common/components/chips";
import { EmptyState } from "@/common/components/empty-state";
import { formatDate } from "@/common/lib/dates";
import { coveredLabel, isSupport, STATUS_LABEL, type Interaction } from "@nxtone/interactions-ui/lib/types";
import { InteractionInspect } from "./interaction-inspect";

const th = "border-b border-border px-3 py-2.5 text-left font-semibold whitespace-nowrap";
const td = "border-b border-muted px-3 py-2.5 align-top";

/**
 * Interactions as a table: student, POC (the student's instructor when it was logged), who took it
 * (tagged "support" when that was someone else), topics, outcome, rating, remarks, date and Inspect.
 * Used by Today's interactions and by Log interaction's "only interactions you took yourself".
 */
export function InteractionsTable({ rows, caption, empty }: { rows: Interaction[]; caption: string; empty: { title: string; description: string } }) {
  return (
    <section aria-label={caption} className="overflow-hidden rounded-xl border border-border bg-card">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[13px]">
            <caption className="sr-only">{caption}: student, POC, who took it, topics, outcome, rating and remarks</caption>
            <thead className="bg-surface-subtle text-xs text-muted-foreground">
              <tr>
                <th scope="col" className={`${th} pl-5`}>Student</th>
                <th scope="col" className={th}>POC (assigned instructor)</th>
                <th scope="col" className={th}>Taken by</th>
                <th scope="col" className={th}>Topics covered</th>
                <th scope="col" className={th}>Outcome</th>
                <th scope="col" className={th}>Rating</th>
                <th scope="col" className={th}>Remarks</th>
                <th scope="col" className={th}>Date</th>
                <th scope="col" className={`${th} pr-5`}>
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td className={`${td} pl-5`}>
                    <div className="font-semibold">{it.studentName}</div>
                    <div className="text-xs text-muted-foreground tabular">{it.niatId}</div>
                  </td>
                  <td className={td}>{it.pocAtTime || "—"}</td>
                  <td className={td}>
                    {it.takenBy}
                    {isSupport(it) ? <div className="mt-0.5 w-fit rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning">support</div> : null}
                  </td>
                  <td className={`${td} text-sidebar-foreground`}>
                    Level {it.level} · {coveredLabel(it.topics, it.subtopics)}
                  </td>
                  <td className={td}>
                    <StatusPill tone={it.status === "Cleared" ? "accent" : it.status === "Need to Revisit" ? "danger" : "neutral"}>{STATUS_LABEL[it.status]}</StatusPill>
                  </td>
                  <td className={`${td} font-semibold whitespace-nowrap tabular`}>{it.rating} / 5</td>
                  <td className={`${td} text-sidebar-foreground`}>
                    <p className="line-clamp-2 max-w-44" title={it.remarks}>
                      {it.remarks || "—"}
                    </p>
                  </td>
                  <td className={`${td} whitespace-nowrap text-sidebar-foreground`}>{formatDate(it.date)}</td>
                  <td className={`${td} pr-5 text-right`}>
                    <InteractionInspect niatId={it.niatId} interactionId={it.id} studentName={it.studentName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState title={empty.title} description={empty.description} />
        </div>
      )}
    </section>
  );
}
