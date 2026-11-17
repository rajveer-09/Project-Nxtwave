/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTestResults, submitTestResults } from "@/modules/tests/actions";
import { Button } from "@/common/ui/button";
import { maxTotal, resultProblems, totalOf, type FormatVersion, type ResultValue } from "@/modules/tests/types";
import { cn } from "@/common/lib/utils";
import { FieldInput } from "@/modules/tests/components/field-input";

export type EntryStudent = { niatId: string; name: string; section: string; attendance30d: number | null };
type Row = { present: boolean; values: Record<string, ResultValue> };

/**
 * Results entry generated from the test's format version: fields marked "column"
 * become the marks table, the rest the per-student feedback panel.
 */
export function ResultsEntry({
  testId,
  format,
  students,
  initial,
  locked,
  lastScores,
}: {
  testId: string;
  format: FormatVersion;
  students: EntryStudent[];
  initial: Record<string, Row | null>;
  locked: boolean;
  lastScores: Record<string, number | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const blank = (): Row => ({ present: true, values: {} });
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(students.map((s) => [s.niatId, initial[s.niatId] ?? blank()])));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [problems, setProblems] = useState<Record<string, string[]>>({});
  const [sel, setSel] = useState(students[0]?.niatId ?? "");

  const columns = format.fields.filter((f) => f.column);
  const panel = format.fields.filter((f) => !f.column);
  const max = maxTotal(format.fields);
  const entered = students.filter((s) => initial[s.niatId] || dirty.has(s.niatId));
  const complete = students.filter((s) => (initial[s.niatId] || dirty.has(s.niatId)) && resultProblems(format.fields, rows[s.niatId]).length === 0).length;
  const totals = students.map((s) => (rows[s.niatId].present ? totalOf(format.fields, rows[s.niatId].values) : null)).filter((t): t is number => t !== null);
  const avg = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "—";
  const below = totals.filter((t) => t < format.passMark).length;

  useEffect(() => {
    if (!dirty.size) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(niatId: string, patch: Partial<Row> | ((row: Row) => Row)) {
    setRows((prev) => ({ ...prev, [niatId]: typeof patch === "function" ? patch(prev[niatId]) : { ...prev[niatId], ...patch } }));
    setDirty((prev) => new Set(prev).add(niatId));
  }

  function save(then?: () => void) {
    const changed = [...dirty].map((niatId) => ({ niatId, ...rows[niatId] }));
    if (!changed.length) {
      then?.();
      return;
    }
    startTransition(async () => {
      const result = await saveTestResults(testId, changed);
      if (!result.ok) {
        setProblems(result.problems ?? {});
        toast.error(result.error);
        return;
      }
      setDirty(new Set());
      setProblems({});
      if (then) then();
      else {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      }
    });
  }

  function submit() {
    save(() =>
      startTransition(async () => {
        const result = await submitTestResults(testId);
        if (!result.ok) {
          setProblems(result.problems ?? {});
          toast.error(result.error);
          const first = Object.keys(result.problems ?? {})[0];
          if (first) setSel(first);
          router.refresh();
          return;
        }
        toast.success("Submitted. Results are locked and now show on each student's page.");
        router.refresh();
      }),
    );
  }

  const selected = students.find((s) => s.niatId === sel);
  const selRow = selected ? rows[selected.niatId] : null;
  const selTotal = selRow?.present ? totalOf(format.fields, selRow.values) : null;
  const missing = students.length - complete;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {[
          ["Complete", `${complete} / ${students.length}`, `${entered.length} started`],
          ["Average", avg, `out of ${max}`],
          ["Below pass", String(below), `scored under ${format.passMark}`],
          ["Absent", String(students.filter((s) => !rows[s.niatId].present).length), "marked absent"],
        ].map(([l, v, sub]) => (
          <div key={l} className="rounded-xl border border-border bg-card px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{l}</dt>
            <dd className={cn("font-heading text-2xl font-semibold tabular", l === "Below pass" && below > 0 && "text-warning")}>{v}</dd>
            <dd className="text-xs text-muted-foreground">{sub}</dd>
          </div>
        ))}
      </dl>

      {locked ? (
        <p className="rounded-xl border border-accent-border bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
          Submitted and locked. Ask an admin to unlock if something needs to change.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Marks" className="min-w-0 flex-[3_1_640px] overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[13px]">
              <caption className="sr-only">Marks for each student</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  <th scope="col" className="border-b border-border py-2.5 pr-2 pl-4">Student</th>
                  <th scope="col" className="border-b border-border px-2 py-2.5">Took test</th>
                  {columns.map((f) => (
                    <th key={f.id} scope="col" className="border-b border-border px-2 py-2.5">
                      {f.label}
                      {f.type === "marks" ? ` /${f.max}` : ""}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-border px-2 py-2.5">Total</th>
                  <th scope="col" className="border-b border-border py-2.5 pr-4 pl-2">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const row = rows[s.niatId];
                  const total = row.present ? totalOf(format.fields, row.values) : null;
                  const rowProblems = problems[s.niatId];
                  const fb = panel.filter((f) => {
                    const v = row.values[f.id];
                    return !(v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length));
                  }).length;
                  return (
                    <tr key={s.niatId} className={cn(sel === s.niatId && "bg-accent/50", dirty.has(s.niatId) && "bg-[#FFFBF5] dark:bg-[#1F1A14]")}>
                      <td className="border-b border-muted py-2 pr-2 pl-4">
                        <span className="font-semibold">{s.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {s.niatId} · {s.section}
                        </div>
                        {rowProblems ? <div className="text-xs font-semibold text-warning">{rowProblems[0]}</div> : null}
                      </td>
                      <td className="border-b border-muted px-2 py-2">
                        <button
                          type="button"
                          aria-pressed={row.present}
                          aria-label={`${s.name} took the test`}
                          disabled={locked}
                          onClick={() => update(s.niatId, { present: !row.present })}
                          className={cn(
                            "min-h-9 min-w-20 rounded-lg border px-2 text-xs font-bold",
                            row.present ? "border-input bg-card" : "border-warning-border bg-warning-soft text-warning",
                          )}
                        >
                          {row.present ? "Present" : "Absent"}
                        </button>
                      </td>
                      {columns.map((f) => (
                        <td key={f.id} className="border-b border-muted px-2 py-2">
                          <FieldInput
                            field={f}
                            compact
                            label={`${s.name} ${f.label}`}
                            disabled={locked || !row.present}
                            value={row.values[f.id]}
                            onChange={(v) => update(s.niatId, (r) => ({ ...r, values: { ...r.values, [f.id]: v } }))}
                          />
                        </td>
                      ))}
                      <td className={cn("border-b border-muted px-2 py-2 font-bold tabular", total !== null && total < format.passMark && "text-warning")}>
                        {!row.present ? "—" : total === null ? "…" : `${total} / ${max}`}
                      </td>
                      <td className="border-b border-muted py-2 pr-4 pl-2">
                        <button
                          type="button"
                          onClick={() => setSel(s.niatId)}
                          aria-pressed={sel === s.niatId}
                          className="min-h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold whitespace-nowrap hover:bg-muted"
                        >
                          {fb ? `${fb} filled · open` : "Add feedback"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className={cn("text-[13px] font-medium", missing ? "text-warning" : "text-muted-foreground")}>
              {locked ? "Locked." : missing ? `${missing} student${missing === 1 ? "" : "s"} still need complete results (or mark them absent).` : "All complete. Submitting locks your results."}
            </span>
            {!locked ? (
              <div className="flex gap-2">
                <Button variant="outline" className="h-10" disabled={pending || !dirty.size} onClick={() => save()}>
                  {dirty.size ? `Save ${dirty.size} change${dirty.size === 1 ? "" : "s"}` : "Saved"}
                </Button>
                <Button className="h-10" disabled={pending} onClick={submit}>
                  Submit results
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {selected && selRow ? (
          <aside aria-labelledby="fb-h" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-muted-foreground">Feedback for</span>
                <h2 id="fb-h" className="text-xl font-semibold">
                  {selected.name}
                </h2>
                <a href={`/students/${selected.niatId}`} className="text-[13px] font-semibold text-primary hover:text-accent-strong">
                  {selected.niatId} · open student page
                </a>
              </div>
              <span className={cn("font-heading text-2xl font-semibold tabular", selTotal !== null && selTotal < format.passMark && "text-warning")}>
                {!selRow.present ? "Absent" : selTotal === null ? "…" : `${selTotal} / ${max}`}
              </span>
            </div>
            <p className="rounded-lg bg-background px-3 py-2 text-xs text-sidebar-foreground">
              Last test: <b>{lastScores[selected.niatId] ?? "—"}</b> · Attendance 30d: <b>{selected.attendance30d === null ? "—" : `${selected.attendance30d}%`}</b>
            </p>
            {panel.map((f) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">
                  {f.label}
                  {f.required ? <span className="text-warning"> *</span> : null}
                </span>
                <FieldInput
                  field={f}
                  disabled={locked || !selRow.present}
                  value={selRow.values[f.id]}
                  onChange={(v) => update(selected.niatId, (r) => ({ ...r, values: { ...r.values, [f.id]: v } }))}
                />
                {f.help ? <span className="text-xs text-muted-foreground">{f.help}</span> : null}
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                className="h-10"
                onClick={() => setSel(students[(students.findIndex((s) => s.niatId === sel) - 1 + students.length) % students.length].niatId)}
              >
                Previous
              </Button>
              <Button className="h-10" onClick={() => setSel(students[(students.findIndex((s) => s.niatId === sel) + 1) % students.length].niatId)}>
                Next student
              </Button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
