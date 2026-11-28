/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/common/components/confirm";
import { EmptyState } from "@/common/components/empty-state";
import { Pager, usePages } from "@/common/components/pager";
import { searchMatcher } from "@/common/lib/search";
import { cn } from "@/common/lib/utils";
import { markTopKAction } from "@/modules/top-k/actions";

/** One Top K student (or a student who could be added), only what the page shows. */
export type TopKRow = {
  niatId: string;
  name: string;
  college: string;
  section: string;
  instructor: string;
  level: number;
  topic: string;
  attendance30d: number | null;
  lastInteractionDays: number | null;
  contestsAttended: number;
  /** Set for students already in Top K. */
  markedBy?: string;
  markedAt?: string;
  source?: "nxtone" | "nxtrank";
};

const field = "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const ago = (d: number | null) => (d === null ? "never" : d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`);
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "");

function useMark() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const mark = (ids: string[], on: boolean, label: string) =>
    start(async () => {
      const r = await markTopKAction(ids, on);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(on ? `${label} added to Top K.` : `${label} removed from Top K.`);
      router.refresh();
    });
  return { mark, pending };
}

/** Add students: search the ones this person may still mark. */
function AddPanel({ candidates, mine }: { candidates: TopKRow[]; mine: boolean }) {
  const [q, setQ] = useState("");
  const { mark, pending } = useMark();
  const match = searchMatcher(q);
  const found = q.trim() ? candidates.filter((s) => match(s.name, s.niatId, s.instructor, s.section, s.college)).slice(0, 8) : [];
  return (
    <section aria-label="Add to Top K" className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-[15px] font-semibold">Add to Top K</h2>
        <p className="text-xs text-muted-foreground">{mine ? `Your students who aren't in your Top K yet (${candidates.length}).` : `Any student who isn't in Top K yet (${candidates.length}).`}</p>
      </div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name or NIAT ID" aria-label="Find a student to add" className={cn(field, "w-full sm:w-96")} />
      {q.trim() ? (
        found.length ? (
          <ul className="flex flex-col divide-y divide-muted rounded-lg border border-border">
            {found.map((s) => (
              <li key={s.niatId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span>
                  <b>{s.name}</b> <span className="text-muted-foreground tabular">{s.niatId}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · Level {s.level} · {s.section}
                    {!mine ? ` · ${s.instructor}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => mark([s.niatId], true, s.name)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Add
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">No match{mine ? " among your students" : ""}.</p>
        )
      ) : null}
    </section>
  );
}

/** Removing asks first: a pop-up names the student and only removes after "Remove". */
function RemoveButton({ s }: { s: TopKRow }) {
  const { ask, dialog, pending } = useConfirm();
  const remove = () =>
    ask({
      title: `Remove ${s.name} from Top K?`,
      description: "They leave Top K and its contest results. You can add them back any time.",
      changes: [
        { label: "Student", after: `${s.name} · ${s.niatId}` },
        { label: "POC", after: s.instructor || "—" },
        ...(s.markedBy ? [{ label: "Added by", after: `${s.markedBy}${s.markedAt ? ` · ${day(s.markedAt)}` : ""}` }] : []),
      ],
      confirmLabel: "Remove",
      danger: true,
      action: async () => {
        const r = await markTopKAction([s.niatId], false);
        return r.ok ? { ok: true as const, message: `${s.name} removed from Top K.` } : { ok: false as const, error: r.error };
      },
    });
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        aria-label={`Remove ${s.name} from Top K`}
        title="Remove from Top K"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:border-warning-border hover:text-warning disabled:opacity-50"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      {dialog}
    </>
  );
}

function StudentTable({ rows, showPoc, canEdit }: { rows: TopKRow[]; showPoc: boolean; canEdit: (s: TopKRow) => boolean }) {
  const pg = usePages(rows, 15);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <caption className="sr-only">Top K students</caption>
          <thead>
            <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
              {["Student", ...(showPoc ? ["POC (instructor)"] : []), "Level · topic", "DSA attendance · 30 days", "Last interaction", "Contests", "In Top K since"].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-3 py-2.5 font-semibold first:pl-5">
                  {h}
                </th>
              ))}
              <th scope="col" className="border-b border-border py-2.5 pr-5 pl-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pg.items.map((s) => (
              <tr key={s.niatId} className="hover:bg-surface-subtle">
                <td className="border-b border-muted py-2.5 pr-3 pl-5">
                  <Link href={`/students/${s.niatId}`} className="font-semibold hover:text-primary hover:underline">
                    {s.name}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular">
                    {s.niatId} · {s.college} · {s.section}
                  </div>
                </td>
                {showPoc ? <td className="border-b border-muted px-3 py-2.5">{s.instructor}</td> : null}
                <td className="border-b border-muted px-3 py-2.5 text-sidebar-foreground">
                  Level {s.level} · {s.topic}
                </td>
                <td className={cn("border-b border-muted px-3 py-2.5 tabular", s.attendance30d !== null && s.attendance30d < 75 && "font-semibold text-warning")}>
                  {s.attendance30d === null ? "—" : `${s.attendance30d}%`}
                </td>
                <td className={cn("border-b border-muted px-3 py-2.5", (s.lastInteractionDays === null || s.lastInteractionDays >= 14) && "text-warning")}>{ago(s.lastInteractionDays)}</td>
                <td className="border-b border-muted px-3 py-2.5 tabular">
                  <Link href={`/contests/students/${s.niatId}`} className="hover:text-primary hover:underline">
                    {s.contestsAttended} taken part
                  </Link>
                </td>
                <td className="border-b border-muted px-3 py-2.5 text-xs text-muted-foreground">
                  {s.source === "nxtrank" ? "From NxtRank" : `${day(s.markedAt)} · ${s.markedBy}`}
                </td>
                <td className="border-b border-muted py-2.5 pr-5 pl-3 text-right">{canEdit(s) ? <RemoveButton s={s} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...pg} label="Top K pages" className="px-5 py-3" />
    </>
  );
}

/** Instructor-wise: each instructor's Top K together. */
function ByInstructor({ rows, onPick }: { rows: TopKRow[]; onPick: (instructor: string) => void }) {
  const groups = [...rows.reduce((m, s) => m.set(s.instructor, [...(m.get(s.instructor) ?? []), s]), new Map<string, TopKRow[]>())].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(([instructor, list]) => (
        <section key={instructor} aria-label={`${instructor}'s Top K`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <button type="button" onClick={() => onPick(instructor)} className="truncate text-left font-semibold hover:text-primary hover:underline" title="Show only this instructor's Top K">
              {instructor}
            </button>
            <span className="shrink-0 rounded-md bg-muted px-1.5 text-xs font-semibold tabular">{list.length}</span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {list.map((s) => (
              <li key={s.niatId}>
                <Link href={`/students/${s.niatId}`} className="inline-block rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-strong hover:underline" title={`${s.niatId} · Level ${s.level}`}>
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TopKBoard({ rows, candidates, seesAll, me }: { rows: TopKRow[]; candidates: TopKRow[]; seesAll: boolean; me: string }) {
  const [q, setQ] = useState("");
  const [instructor, setInstructor] = useState("");
  const [view, setView] = useState<"students" | "instructors">("students");
  const match = searchMatcher(q);
  const shown = rows.filter((s) => (!instructor || s.instructor === instructor) && match(s.name, s.niatId, s.instructor, s.section, s.college, s.topic));
  const instructors = [...new Set(rows.map((s) => s.instructor))].sort();
  const canEdit = (s: TopKRow) => seesAll || s.instructor === me;

  return (
    <div className="flex flex-col gap-5">
      <AddPanel candidates={candidates} mine={!seesAll} />
      <section aria-label="Top K students" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold">{seesAll ? "Top K students" : "Your Top K"}</h2>
            <p className="text-xs text-muted-foreground">
              {shown.length === rows.length ? `${rows.length} students` : `${shown.length} of ${rows.length} students`}
              {seesAll ? ` · ${instructors.length} instructors` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, NIAT ID, topic" aria-label="Search Top K" className={cn(field, "w-full sm:w-60")} />
            {seesAll ? (
              <>
                <select value={instructor} onChange={(e) => setInstructor(e.target.value)} aria-label="Instructor (POC)" className={cn(field, "w-full sm:w-56")}>
                  <option value="">All instructors</option>
                  {instructors.map((name) => (
                    <option key={name} value={name}>
                      {name} ({rows.filter((s) => s.instructor === name).length})
                    </option>
                  ))}
                </select>
                <div role="group" aria-label="View" className="flex gap-1 rounded-lg bg-muted p-1">
                  {(
                    [
                      ["students", "By student"],
                      ["instructors", "By instructor"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                      className={cn("h-8 rounded-md px-3 text-xs font-semibold", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
        {!rows.length ? (
          <div className="p-5">
            <EmptyState title={seesAll ? "No Top K students yet" : "Your Top K is empty"} description={seesAll ? "Instructors add their best students here." : "Add the students you count among your best, using the search above."} />
          </div>
        ) : !shown.length ? (
          <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">No Top K student matches.</p>
        ) : view === "instructors" && seesAll ? (
          <ByInstructor
            rows={shown}
            onPick={(name) => {
              setInstructor(name);
              setView("students");
            }}
          />
        ) : (
          <StudentTable key={`${instructor}|${q}`} rows={shown} showPoc={seesAll} canEdit={canEdit} />
        )}
      </section>
    </div>
  );
}
