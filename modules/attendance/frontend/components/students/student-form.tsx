/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { ApiError } from "@/common/lib/api-client";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { DANGER_BUTTON, inputClass, refreshAttendance, selectClass, studentHref } from "@nxtone/attendance-ui/components/students/ui";
import type { ProfileStudent, StudentForm } from "@nxtone/attendance-ui/types";

/** The attendance degrees table holds BITS and CDU; the service rejects anything else. */
const DEGREES = ["BITS", "CDU"];

const BLANK: StudentForm = { niat_id: "", name: "", degree: "BITS", section: "", level: "", hall_no: "", poc: "", coach: "", status: "active", joined_on: "", dropped_on: "" };

export function formFor(s: ProfileStudent): StudentForm {
  return {
    name: s.name,
    degree: s.degree,
    section: s.section,
    level: s.level ?? "",
    hall_no: s.hall_no,
    poc: s.poc,
    coach: s.coach,
    status: s.status === "dropped" ? "dropped" : "active",
    joined_on: s.joined_on ?? "",
    dropped_on: s.dropped_on ?? "",
  };
}

/** Per-field messages from a 422 validation_failed, or {} for other errors. */
function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError && err.status === 422 && err.details && typeof err.details === "object" && !Array.isArray(err.details)
    ? (err.details as Record<string, string>)
    : {};
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Add one student (no `student`) or edit one. The NIAT ID is set only when adding. The service
 * validates and normalises everything; required / maxLength here are only for convenience.
 */
export function StudentFormCard({ student, onDone }: { student?: ProfileStudent; onDone: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const editing = !!student;
  const [f, setF] = useState<StudentForm>(student ? formFor(student) : BLANK);
  const set = (k: keyof StudentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => (student ? attendanceApi.updateStudent(student.niat_id, f) : attendanceApi.createStudent(f)),
    onSuccess: (res) => {
      void refreshAttendance(qc);
      onDone();
      if (!editing) router.push(studentHref(res.niat_id));
    },
  });
  const errs = fieldErrors(save.error);
  const hasFieldErrors = Object.keys(errs).length > 0;

  const field = (k: keyof StudentForm, label: string, input: React.ReactElement, hint?: string) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      {input}
      {errs[k] ? <span className="font-normal text-red-700 dark:text-red-400">{errs[k]}</span> : hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
  const invalid = (k: keyof StudentForm) => (errs[k] ? true : undefined);

  return (
    <Panel
      title={student ? `Edit ${student.name}` : "Add a student"}
      description={student ? `NIAT ID ${student.niat_id} can't be changed, because the attendance marks belong to it.` : "For one student. To add many, use Imports → Students."}
    >
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {!editing
          ? field("niat_id", "NIAT ID *", <input className={cn(inputClass, "font-mono uppercase")} value={f.niat_id} onChange={set("niat_id")} placeholder="N24H01A0598" aria-invalid={invalid("niat_id")} required />)
          : null}
        {field("name", "Full name *", <input className={inputClass} value={f.name} onChange={set("name")} maxLength={100} aria-invalid={invalid("name")} required />)}
        {field(
          "degree",
          "Degree *",
          <select className={cn(selectClass, "w-full")} value={f.degree} onChange={set("degree")} aria-invalid={invalid("degree")}>
            {DEGREES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>,
        )}
        {field("section", "Section *", <input className={cn(inputClass, "uppercase")} value={f.section} onChange={set("section")} placeholder="S001" maxLength={20} aria-invalid={invalid("section")} required />)}
        {field("level", "Level", <input className={inputClass} value={f.level} onChange={set("level")} placeholder="Level 2" maxLength={100} aria-invalid={invalid("level")} />)}
        {field("hall_no", "Hall", <input className={inputClass} value={f.hall_no} onChange={set("hall_no")} placeholder="Hall 2" maxLength={100} aria-invalid={invalid("hall_no")} />, "H-2 is saved as Hall 2.")}
        {field("poc", "POC (instructor)", <input className={inputClass} value={f.poc} onChange={set("poc")} maxLength={100} aria-invalid={invalid("poc")} />, "A new name adds a new POC.")}
        {field("coach", "Success coach", <input className={inputClass} value={f.coach} onChange={set("coach")} maxLength={100} aria-invalid={invalid("coach")} />)}
        {field("joined_on", "Joined on", <input type="date" className={inputClass} value={f.joined_on} onChange={set("joined_on")} aria-invalid={invalid("joined_on")} />, "Blank: counts from the term start.")}
        {editing ? (
          <>
            {field(
              "status",
              "Status",
              <select className={cn(selectClass, "w-full")} value={f.status} onChange={set("status")} aria-invalid={invalid("status")}>
                <option value="active">Active</option>
                <option value="dropped">Dropped</option>
              </select>,
            )}
            {f.status === "dropped"
              ? field("dropped_on", "Dropped on *", <input type="date" className={inputClass} value={f.dropped_on} onChange={set("dropped_on")} aria-invalid={invalid("dropped_on")} required />, "Days after this stop counting.")
              : null}
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add student"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          {save.error && !hasFieldErrors ? <span role="alert" className="text-[13px] text-red-700 dark:text-red-400">{save.error.message}</span> : null}
          {hasFieldErrors ? <span role="alert" className="text-[13px] text-red-700 dark:text-red-400">Fix the fields marked in red.</span> : null}
        </div>
      </form>
    </Panel>
  );
}

/**
 * Removing a student. Marking them dropped keeps their marks and can be undone from Edit;
 * deleting also deletes every mark, Owner only, after typing the NIAT ID (the service checks both).
 */
export function RemoveStudentCard({ student, today, isOwner, onDone }: { student: ProfileStudent; today: string; isOwner: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [droppedOn, setDroppedOn] = useState(today);
  const [confirm, setConfirm] = useState("");

  const drop = useMutation({
    mutationFn: () => attendanceApi.updateStudent(student.niat_id, { ...formFor(student), status: "dropped", dropped_on: droppedOn }),
    onSuccess: () => {
      void refreshAttendance(qc);
      onDone();
    },
  });
  const del = useMutation({
    mutationFn: () => attendanceApi.deleteStudent(student.niat_id, confirm),
    onSuccess: () => {
      void refreshAttendance(qc);
      router.push("/attendance/students");
    },
  });

  return (
    <Panel title={`Remove ${student.name}`} description="Choose how. Marking as dropped is usually right; it can be undone from Edit.">
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-[13px]">
        <div className="font-semibold">Mark as dropped (keeps history)</div>
        <p className="text-muted-foreground">The student is hidden from the student search and attendance marking. Their marks stay, and days after the drop date stop counting.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Dropped on
            <input type="date" className={cn(inputClass, "w-44")} value={droppedOn} max={today} onChange={(e) => setDroppedOn(e.target.value)} />
          </label>
          <Button disabled={!droppedOn || drop.isPending} onClick={() => drop.mutate()}>
            {drop.isPending ? "Saving…" : "Mark as dropped"}
          </Button>
        </div>
        {drop.error ? <p role="alert" className="text-red-700 dark:text-red-400">{drop.error.message}</p> : null}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <div className="font-semibold">Delete permanently</div>
        {isOwner ? (
          <>
            <p>
              Deletes the student and <b>all of their attendance marks</b>. This cannot be undone (only a database backup brings it back). Use it for a student added by mistake.
              Type <b className="font-mono">{student.niat_id}</b> to confirm.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <input
                className={cn(inputClass, "w-56 font-mono uppercase")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label="Type the NIAT ID to confirm"
                placeholder={student.niat_id}
              />
              <Button className={DANGER_BUTTON} disabled={confirm.trim().toUpperCase() !== student.niat_id || del.isPending} onClick={() => del.mutate()}>
                {del.isPending ? "Deleting…" : "Delete student and marks"}
              </Button>
            </div>
            {del.error ? <p role="alert" className="text-red-700 dark:text-red-400">{del.error.message}</p> : null}
          </>
        ) : (
          <p>Only the Owner can delete a student permanently. Mark them as dropped instead, or ask the Owner.</p>
        )}
      </div>

      <div>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
