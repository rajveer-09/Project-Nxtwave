/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { PeriodList } from "@nxtone/attendance-ui/components/students/student-profile";
import { DANGER_BUTTON, fmtDate, fmtDay, inputClass, NOTICE, refreshAttendance } from "@nxtone/attendance-ui/components/students/ui";
import type { InternshipResult, Period, Profile } from "@nxtone/attendance-ui/types";

type Form = { periodId: number | null; start: string; end: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Admin card on the student page: assign, edit, extend, end or cancel an internship, and see every
 * internship and registration-pending period (cancelled ones too). The service checks overlaps
 * and conflicts; the form always runs a check (dry run) before saving.
 */
export function InternshipAdminCard({ p }: { p: Profile }) {
  const qc = useQueryClient();
  const s = p.student;
  const [form, setForm] = useState<Form | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const cancel = useMutation({
    mutationFn: (id: number) => attendanceApi.cancelInternship(id),
    onSuccess: (r) => {
      setConfirmCancel(null);
      setMsg(`Internship cancelled. ${plural(r.marks_removed, "internship mark")} removed; marks changed by hand were kept.`);
      void refreshAttendance(qc);
    },
  });

  const editable = (x: Period) => x.kind === "INTERNSHIP" && x.state !== "cancelled";
  const open = (f: Form) => {
    setMsg("");
    setConfirmCancel(null);
    setForm(f);
  };

  return (
    <section aria-labelledby="att-intern-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="att-intern-h" className="text-[15px] font-bold">
            Internship and registration
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Internship days are marked Present. Term 5 registration-pending periods come from imported sheets and are marked Absent. Cancelled periods stay here as history.
          </p>
        </div>
        {s.status === "active" && !form ? (
          <Button size="sm" onClick={() => open({ periodId: null, start: p.today, end: p.today })}>
            Assign internship
          </Button>
        ) : null}
      </div>
      {msg ? <p className={NOTICE.success}>{msg}</p> : null}
      {form ? (
        <InternshipForm
          key={`${form.periodId}-${form.start}-${form.end}`}
          niatId={s.niat_id}
          initial={form}
          onClose={() => setForm(null)}
          onSaved={(text) => {
            setForm(null);
            setMsg(text);
            void refreshAttendance(qc);
          }}
        />
      ) : null}
      {p.periods.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No internship or registration-pending periods.</p>
      ) : (
        <PeriodList
          periods={p.periods}
          actions={(x) =>
            editable(x) ? (
              <div className="flex flex-wrap gap-1.5">
                {confirmCancel === x.id ? (
                  <>
                    <span className="self-center text-xs text-red-800 dark:text-red-300">Remove its Present marks and cancel?</span>
                    <Button size="sm" className={DANGER_BUTTON} disabled={cancel.isPending} onClick={() => cancel.mutate(x.id)}>
                      {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmCancel(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => open({ periodId: x.id, start: x.start, end: x.end })}>
                      Edit / extend
                    </Button>
                    {x.state === "active" ? (
                      <Button size="sm" variant="outline" onClick={() => open({ periodId: x.id, start: x.start, end: p.today })}>
                        End today
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="text-red-700 dark:text-red-400" onClick={() => setConfirmCancel(x.id)}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            ) : null
          }
        />
      )}
      {cancel.error ? <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">{cancel.error.message}</p> : null}
    </section>
  );
}

/** Dates, then Check (dry run: days and conflicting marks), then Save. Changing a date discards the check. */
function InternshipForm({ niatId, initial, onClose, onSaved }: { niatId: string; initial: Form; onClose: () => void; onSaved: (msg: string) => void }) {
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [overwrite, setOverwrite] = useState(false);
  const [checked, setChecked] = useState<InternshipResult | null>(null);
  const periodId = initial.periodId;

  const run = (dryRun: boolean) => {
    const input = { start, end, overwrite, dry_run: dryRun };
    return periodId !== null ? attendanceApi.updateInternship(periodId, input) : attendanceApi.createInternship(niatId, input);
  };
  const check = useMutation({ mutationFn: () => run(true), onSuccess: setChecked });
  const save = useMutation({
    mutationFn: () => run(false),
    onSuccess: (r) =>
      onSaved(
        `Internship saved: ${fmtDate(start)} to ${fmtDate(end)}. ${plural(r.marks_saved, "day")} marked Present` +
          (r.marks_kept ? `, ${plural(r.marks_kept, "existing mark")} kept` : "") +
          (r.marks_removed ? `, ${plural(r.marks_removed, "internship mark")} removed` : "") +
          ".",
      ),
  });
  const changed = () => {
    setChecked(null);
    check.reset();
    save.reset();
  };
  const error = check.error ?? save.error;
  const conflicts = checked?.conflicts ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-[13px] dark:border-violet-900 dark:bg-violet-950/30">
      <div className="font-semibold">{periodId !== null ? "Edit, extend or end internship" : "Assign internship"}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          First day
          <input
            type="date"
            className={cn(inputClass, "w-40")}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              changed();
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Last day
          <input
            type="date"
            className={cn(inputClass, "w-40")}
            value={end}
            min={start}
            onChange={(e) => {
              setEnd(e.target.value);
              changed();
            }}
          />
        </label>
        <Button variant="outline" disabled={!start || !end || end < start || check.isPending} onClick={() => check.mutate()}>
          {check.isPending ? "Checking…" : "Check days"}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {checked ? (
        <div className="flex flex-col gap-2">
          <p>
            {checked.days === 0
              ? "No new days: only days no longer covered lose their internship marks."
              : `${plural(checked.days, "day")} will be marked Present (Internship). Holidays and Sundays are marked too but never count.`}
          </p>
          {conflicts.length > 0 ? (
            <div className={NOTICE.warning}>
              <p className="font-semibold">
                {conflicts.length} of these day{conflicts.length === 1 ? " already has" : "s already have"} a mark:
              </p>
              <ul className="mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
                {conflicts.map((c) => (
                  <li key={c.date}>
                    {fmtDay(c.date)}: {c.status === "P" ? "Present" : "Absent"}
                    {c.category === "REGISTRATION_PENDING" ? " (registration pending)" : c.category === "INTERNSHIP" ? " (internship)" : ""}
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                Overwrite these with Present (Internship). Leave unticked to keep them as they are.
              </label>
            </div>
          ) : null}
          <div>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : periodId !== null ? "Save changes" : "Assign internship"}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-red-700 dark:text-red-400">{error.message}</p> : null}
    </div>
  );
}
