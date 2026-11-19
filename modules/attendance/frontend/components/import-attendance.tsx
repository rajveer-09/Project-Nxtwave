/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { formatDate } from "@/common/lib/dates";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { AttendanceImportResult, AttendanceImportRow, MissingDate } from "@nxtone/attendance-ui/types";
import { Badge, CATEGORY, Count, FilePicker, Notice, RowNotes, SampleLink, control, formatDay, tableWrap, td, th, theadRow, type Tone } from "./import-ui";

const STATUS: Record<AttendanceImportRow["status"], { label: string; tone: Tone }> = {
  update: { label: "Will update", tone: "blue" },
  unchanged: { label: "No change", tone: "neutral" },
  error: { label: "Error", tone: "red" },
};

/** Errors that block Confirm unless the admin chooses to skip them. */
export const attendanceHasErrors = (p: AttendanceImportResult) => p.summary.error_rows > 0 || p.header_errors.length > 0 || p.bad_columns.length > 0;

/** The admin's mapping of unsupported values to Present or Absent. */
export type ValueMap = Record<string, "P" | "A">;

/** "and 2 internship / registration period(s)" for the saved message; "" when none. */
export const periodsSaved = (n: number) => (n > 0 ? ` and ${n} internship / registration period${n === 1 ? "" : "s"}` : "");

/** Ported from the attendance dashboard's Import attendance card. Saves marks only, for existing students. */
export function ImportAttendance() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceImportResult | null>(null);
  const [columnDates, setColumnDates] = useState<Record<number, string>>({});
  const [valueMap, setValueMap] = useState<ValueMap>({});
  const [skipErrors, setSkipErrors] = useState(false);
  const [done, setDone] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setColumnDates({});
    setValueMap({});
    setSkipErrors(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const check = useMutation({
    mutationFn: (v: { file: File; columnDates: Record<number, string>; valueMap: ValueMap }) => attendanceApi.importAttendance(v.file, { columnDates: v.columnDates, valueMap: v.valueMap }),
    onSuccess: setPreview,
  });
  const recheck = (cd: Record<number, string>) => {
    setColumnDates(cd);
    if (file) check.mutate({ file, columnDates: cd, valueMap });
  };
  const remap = (vm: ValueMap) => {
    setValueMap(vm);
    if (file) check.mutate({ file, columnDates, valueMap: vm });
  };
  const save = useMutation({
    mutationFn: () => attendanceApi.importAttendance(file!, { commit: true, skipErrors, columnDates, valueMap }),
    onSuccess: (res) => {
      setDone(`Imported ${res.file_name}: saved ${res.saved} mark(s) for ${res.summary.students_affected} student(s)${periodsSaved(res.summary.periods_to_save)}.`);
      reset();
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const s = preview?.summary;
  const hasErrors = !!preview && attendanceHasErrors(preview);
  const error = check.error ?? save.error;
  const nothing = !!s && s.records_to_update === 0 && s.periods_to_save === 0;
  const partial = !!preview && preview.unsupported.length > 0;

  return (
    <SectionCard
      title="Import attendance"
      description={
        <>
          Saves marks only, for students who already exist (to add or update students too, use Import students). Takes the same sheet: NIAT ID, Student Name, Degree, Section, Hall No., Level,
          then one column per date (19-Aug-2026, 19-Aug-26, 19/08/2026 or 2026-08-19); only NIAT ID and the date columns are required. Values: Present, Absent, P, A, 1 or 0, plus Internship
          Period (saved as Present) and Term 5 Registration Pending (saved as Absent). Blank cells change nothing. Any other value (like #REF!) is listed in the preview and not saved unless
          you map it. <SampleLink kind="attendance" />
        </>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilePicker
          inputRef={inputRef}
          file={file}
          label="Attendance sheet"
          onPick={(f) => {
            setFile(f);
            setPreview(null);
            setColumnDates({});
            setValueMap({});
            setDone("");
            check.reset();
            save.reset();
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4" disabled={!file || check.isPending} onClick={() => file && check.mutate({ file, columnDates, valueMap })}>
            {check.isPending ? "Checking…" : "Preview"}
          </Button>
          {file || preview ? (
            <Button variant="ghost" className="h-10" onClick={reset}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {done ? <Notice tone="green">{done}</Notice> : null}
      {error ? <Notice tone="red">{error.message}</Notice> : null}

      {preview && s ? (
        <>
          <AttendancePreview source="attendance" preview={preview} columnDates={columnDates} onColumnDates={recheck} valueMap={valueMap} onValueMap={remap} />
          <ConfirmRow
            hasErrors={hasErrors}
            skipErrors={skipErrors}
            onSkipErrors={setSkipErrors}
            partial={partial}
            disabled={nothing || (hasErrors && !skipErrors) || save.isPending}
            onCancel={reset}
            onConfirm={() => save.mutate()}
            label={save.isPending ? "Importing…" : nothing ? "Nothing to import" : partial ? "Continue with valid data" : "Confirm import"}
          />
        </>
      ) : null}
    </SectionCard>
  );
}

/** The bottom row of a preview: skip-errors choice and the confirm button. */
export function ConfirmRow({
  hasErrors,
  skipErrors,
  onSkipErrors,
  partial,
  disabled,
  label,
  onCancel,
  onConfirm,
  skipText = "Skip the rows and columns with errors and import the rest",
}: {
  hasErrors: boolean;
  skipErrors: boolean;
  onSkipErrors: (v: boolean) => void;
  partial: boolean;
  disabled: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  skipText?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      {hasErrors ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={skipErrors} onChange={(e) => onSkipErrors(e.target.checked)} />
          {skipText}
        </label>
      ) : (
        <span className="text-sm text-muted-foreground">
          {partial ? "Unsupported values above will not be saved. Map them, or continue with the valid data." : "No errors found. Nothing is saved until you confirm."}
        </span>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="h-10" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="h-10 px-4" disabled={disabled} onClick={onConfirm}>
          {label}
        </Button>
      </div>
    </div>
  );
}

/**
 * The attendance part of an import preview: dates read, counts, column problems (with a date
 * picker for unreadable headers), missing-date suggestions and one row per student. Shared by
 * both import cards. onColumnDates re-runs the preview; it also refreshes it after calendar
 * entries are saved.
 */
export function AttendancePreview({
  preview,
  columnDates,
  onColumnDates,
  valueMap,
  onValueMap,
  source,
}: {
  /** The import tab, recorded with calendar entries saved from this preview. */
  source: "attendance" | "students";
  preview: AttendanceImportResult;
  columnDates: Record<number, string>;
  onColumnDates: (next: Record<number, string>) => void;
  valueMap: ValueMap;
  onValueMap: (next: ValueMap) => void;
}) {
  const queryClient = useQueryClient();
  const s = preview.summary;
  const given = Object.entries(columnDates);

  return (
    <>
      <div className="rounded-lg bg-surface-subtle px-3.5 py-2.5 text-sm ring-1 ring-border ring-inset">
        <div>
          <span className="text-muted-foreground">File:</span> <b>{preview.file_name}</b>
        </div>
        <div>
          <span className="text-muted-foreground">Dates ({preview.dates.length}):</span> {preview.dates.length ? preview.dates.map(formatDate).join(", ") : "none"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Count label="Rows" n={s.rows} tone="neutral" />
        <Count label="Students affected" n={s.students_affected} tone="blue" />
        <Count label="Records to update" n={s.records_to_update} tone="blue" />
        <Count label="Already the same" n={s.unchanged_records} tone="neutral" />
        <Count label="Blank cells (no change)" n={s.blank_cells} tone="neutral" />
        <Count label="Skipped cells" n={s.skipped_cells} tone="amber" />
        <Count label="Error rows" n={s.error_rows} tone="red" />
        <Count label="Periods to save" n={s.periods_to_save} tone="violet" />
      </div>

      <CategoriesFound preview={preview} />
      <UnsupportedValues key={preview.unsupported.map((u) => u.value).join()} preview={preview} valueMap={valueMap} onValueMap={onValueMap} />
      {preview.ignored_columns.length > 0 ? (
        <Notice tone="neutral" className="text-foreground">
          <b>Columns not read ({preview.ignored_columns.length}):</b> {preview.ignored_columns.map((c) => `“${c}”`).join(", ")}. They are neither a date nor a student column, so nothing in them is saved.
        </Notice>
      ) : null}

      {preview.bad_columns.map((c) => (
        <BadColumnPicker key={`${c.column}-${c.suggested}`} col={c} onUse={(d) => onColumnDates({ ...columnDates, [c.column]: d })} />
      ))}
      {given.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg px-3.5 py-2.5 text-sm ring-1 ring-border ring-inset">
          {given.map(([col, d]) => (
            <li key={col} className="flex items-center justify-between gap-2">
              <span>
                Column {Number(col) + 1} is read as <b>{formatDay(d)}</b> (date given by you).
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => onColumnDates(Object.fromEntries(given.filter(([c]) => c !== col)))}>
                Undo
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {preview.header_errors.length > 0 ? (
        <Notice tone="red">
          <ul>
            {preview.header_errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {preview.header_warnings.length > 0 ? (
        <Notice tone="amber">
          <ul>
            {preview.header_warnings.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {preview.missing_dates.length > 0 ? (
        <MissingDateSuggestions
          key={preview.missing_dates.map((m) => m.date + m.entries.length).join()}
          missing={preview.missing_dates}
          upload={{ file_name: preview.file_name, kind: source }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["attendance"] });
            onColumnDates(columnDates); // refresh the preview with the new calendar
          }}
        />
      ) : null}

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={theadRow}>
              <th className={th}>Row</th>
              <th className={th}>NIAT ID</th>
              <th className={th}>Name</th>
              <th className={th}>Result</th>
              <th className={`${th} text-right`}>Records</th>
              <th className={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r) => (
              <tr key={r.row} className={`border-t border-border align-top ${r.status === "error" ? "bg-red-50/40 dark:bg-red-950/20" : ""}`}>
                <td className={`${td} text-muted-foreground tabular`}>{r.row}</td>
                <td className={`${td} font-mono text-xs`}>{r.niat_id || "—"}</td>
                <td className={td}>
                  {r.status !== "error" ? (
                    <Link href={`/students/${r.niat_id}`} target="_blank" className="font-semibold hover:text-primary hover:underline">
                      {r.name || r.niat_id}
                    </Link>
                  ) : (
                    r.name || "—"
                  )}
                </td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </td>
                <td className={`${td} text-right tabular`}>{r.changes}</td>
                <td className={`${td} text-xs`}>
                  <RowNotes errors={r.errors} skipped={r.skipped} warnings={r.warnings} blank={r.blank} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PERIOD_ACTION = { new: "New", extend: "Extended", unchanged: "No change" } as const;

/** Recognised categories (Internship Period, Term 5 Registration Pending) and the periods they make. */
function CategoriesFound({ preview }: { preview: AttendanceImportResult }) {
  if (preview.categories.length === 0 && preview.periods.length === 0) return null;
  return (
    <Notice tone="violet" className="flex flex-col gap-2 text-foreground">
      <div className="font-semibold">Categories recognised</div>
      <ul className="flex flex-col gap-1">
        {preview.categories.map((c) => (
          <li key={c.category} className="flex flex-wrap items-center gap-2">
            <Badge tone={CATEGORY[c.category].tone}>{CATEGORY[c.category].label}</Badge>
            <span>
              saved as <b>{c.status === "P" ? "Present" : "Absent"}</b>: {c.cells} cell{c.cells === 1 ? "" : "s"}, {formatDate(c.from)} to {formatDate(c.to)}
            </span>
          </li>
        ))}
      </ul>
      {preview.periods.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className={theadRow}>
                <th className="px-2.5 py-2 font-medium">Student</th>
                <th className="px-2.5 py-2 font-medium">Period</th>
                <th className="px-2.5 py-2 font-medium">Dates</th>
                <th className="px-2.5 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {preview.periods.map((p) => (
                <tr key={`${p.niat_id}-${p.kind}-${p.start}`} className="border-t border-border">
                  <td className="px-2.5 py-1.5">
                    {p.name || p.niat_id} <span className="font-mono text-muted-foreground">{p.niat_id}</span>
                  </td>
                  <td className="px-2.5 py-1.5">{CATEGORY[p.kind].short}</td>
                  <td className="px-2.5 py-1.5">
                    {formatDate(p.start)} – {formatDate(p.end)}
                    {p.kind === "REGISTRATION_PENDING" ? (p.completed_on ? <> · completed by {formatDate(p.completed_on)}</> : <> · still pending (no end date in the sheet)</>) : null}
                  </td>
                  <td className="px-2.5 py-1.5">{PERIOD_ACTION[p.action]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Notice>
  );
}

/** Values that are not saved (like #REF!), with the reason. The admin may map each to Present or Absent and re-check. */
function UnsupportedValues({ preview, valueMap, onValueMap }: { preview: AttendanceImportResult; valueMap: ValueMap; onValueMap: (next: ValueMap) => void }) {
  const [draft, setDraft] = useState<Record<string, "" | "P" | "A">>({});
  const chosen = Object.entries(draft).filter(([, v]) => v !== "") as [string, "P" | "A"][];
  const total = preview.unsupported.reduce((n, u) => n + u.cells, 0);
  if (preview.unsupported.length === 0 && preview.mapped.length === 0) return null;
  const code = "rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground ring-1 ring-warning-border";

  return (
    <Notice tone="amber" className="flex flex-col gap-2 text-foreground">
      {preview.unsupported.length > 0 ? (
        <>
          <div className="font-semibold">
            Not saved: {total} cell{total === 1 ? "" : "s"} with {preview.unsupported.length} unsupported value{preview.unsupported.length === 1 ? "" : "s"}
          </div>
          <p className="text-xs text-muted-foreground">{preview.unsupported[0].reason} The rest of the sheet is still saved.</p>
          <ul className="flex flex-col gap-1.5">
            {preview.unsupported.map((u) => (
              <li key={u.value} className="flex flex-wrap items-center gap-2">
                <code className={code}>{u.value}</code>
                <span className="text-xs text-muted-foreground">
                  {u.cells} cell{u.cells === 1 ? "" : "s"}
                </span>
                <select aria-label={`Map ${u.value}`} className={`${control} ml-auto h-9 text-xs`} value={draft[u.value] ?? ""} onChange={(e) => setDraft({ ...draft, [u.value]: e.target.value as "" | "P" | "A" })}>
                  <option value="">Leave unmarked (skip)</option>
                  <option value="P">Map to Present</option>
                  <option value="A">Map to Absent</option>
                </select>
              </li>
            ))}
          </ul>
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={chosen.length === 0}
              onClick={() => {
                onValueMap({ ...valueMap, ...Object.fromEntries(chosen) });
                setDraft({});
              }}
            >
              Apply mapping and re-check
            </Button>
          </div>
        </>
      ) : null}
      {preview.mapped.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-warning-border pt-2">
          {preview.mapped.map((m) => (
            <li key={m.value} className="flex items-center justify-between gap-2">
              <span>
                <code className={code}>{m.value}</code> is saved as <b>{m.status === "P" ? "Present" : "Absent"}</b> ({m.cells} cell{m.cells === 1 ? "" : "s"}, mapped by you)
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onValueMap(Object.fromEntries(Object.entries(valueMap).filter(([k]) => k.trim().toLowerCase() !== m.value.trim().toLowerCase())))}
              >
                Undo
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

/** An unreadable date header: its marks are read only after the admin confirms a date. */
function BadColumnPicker({ col, onUse }: { col: AttendanceImportResult["bad_columns"][number]; onUse: (date: string) => void }) {
  const [date, setDate] = useState(col.suggested);
  return (
    <Notice tone="red" className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="flex-1">
        Column {col.column + 1} has the header <b>“{col.header}”</b>, which is not a readable date, so its marks are not read yet.
        {col.suggested ? <> Suggested date: {formatDay(col.suggested)}, the last class day before the next column.</> : null} Check the date and click Use this date.
      </span>
      <input type="date" aria-label={`Date for column ${col.column + 1}`} className={control} value={date} onChange={(e) => setDate(e.target.value)} />
      <Button type="button" className="h-10" disabled={!date} onClick={() => onUse(date)}>
        Use this date
      </Button>
    </Notice>
  );
}

const scopeLabel = (a: string) => (a === "ALL" ? "All" : a);
const KIND_LABEL: Record<string, string> = { working: "Working", holiday: "Holiday", exam: "Exam", exam_prep: "Exam preparation", event: "Event" };

/**
 * Dates between the first and last date column that have no column (Sundays left out). Only
 * suggestions: the admin picks which to save as calendar entries. Attendance marks are never changed.
 */
function MissingDateSuggestions({ missing, upload, onSaved }: { missing: MissingDate[]; upload: { file_name: string; kind: "attendance" | "students" }; onSaved: () => void }) {
  // Start with the dates that have no calendar entry yet.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(missing.filter((m) => m.entries.length === 0).map((m) => m.date)));
  const [dayType, setDayType] = useState<"holiday" | "exam" | "exam_prep">("holiday");
  const [appliesTo, setAppliesTo] = useState("ALL");
  const [label, setLabel] = useState("Holiday");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const scope = dayType === "exam" && appliesTo === "ALL" ? "" : appliesTo; // exams apply to one degree
  const toggle = (d: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  const replacing = missing.filter((m) => selected.has(m.date) && m.entries.some((e) => e.applies_to === scope)).length;

  const save = useMutation({
    mutationFn: () =>
      attendanceApi.saveCalendarEntries(
        missing.filter((m) => selected.has(m.date)).map((m) => ({ date: m.date, applies_to: scope, day_type: dayType, label: label.trim() })),
        upload,
      ),
    onSuccess: (r) => {
      setMsg({ ok: true, text: `Saved ${r.saved} calendar entr${r.saved === 1 ? "y" : "ies"}.${r.warning ? ` ${r.warning}` : ""}` });
      onSaved();
    },
    onError: (e: Error) => setMsg({ ok: false, text: e.message }),
  });

  return (
    <Notice tone="amber" className="text-foreground">
      <div className="font-semibold">Dates with no column in this sheet ({missing.length})</div>
      <p className="mt-1 text-xs text-muted-foreground">
        These weekdays fall between the first and last date columns but have no column (Sundays are left out). They are only suggestions: a missing column does not prove the day was a
        holiday, and nothing is saved unless you choose dates below. Attendance marks are never changed here.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(missing.map((m) => m.date)))}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set())}>
          Select none
        </Button>
      </div>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {missing.map((m) => (
          <li key={m.date}>
            <label className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-card">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={selected.has(m.date)} onChange={() => toggle(m.date)} />
              <span>
                <span className="font-semibold">{formatDay(m.date)}</span>
                {m.entries.map((e) => (
                  <span key={e.applies_to} className="ml-1 text-xs text-muted-foreground">
                    · already {KIND_LABEL[e.day_type] ?? e.day_type} ({scopeLabel(e.applies_to)}){e.label ? `: ${e.label}` : ""}
                  </span>
                ))}
                {m.has_marks ? <span className="ml-1 text-xs text-warning">· has attendance marks</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-4 sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Save selected as
          <select
            className={control}
            value={dayType}
            onChange={(e) => {
              const v = e.target.value as "holiday" | "exam" | "exam_prep";
              setDayType(v);
              if (v === "exam" && appliesTo === "ALL") setAppliesTo("BITS");
              if (label === "Holiday" || label === "Exam" || label === "Exam preparation") setLabel(v === "exam" ? "Exam" : v === "exam_prep" ? "Exam preparation" : "Holiday");
            }}
          >
            <option value="holiday">Holiday</option>
            <option value="exam">Exam (one degree)</option>
            <option value="exam_prep">Exam preparation</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Applies to
          <select className={control} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
            {dayType !== "exam" ? <option value="ALL">All degrees</option> : null}
            <option value="BITS">BITS only</option>
            <option value="CDU">CDU only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Label
          <input className={control} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <Button type="button" className="h-10" disabled={selected.size === 0 || !scope || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : `Save ${selected.size} date${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>
      {replacing > 0 ? (
        <p className="mt-2 text-xs text-warning">
          {replacing} selected date(s) already have a {scopeLabel(scope)} entry; it will be replaced.
        </p>
      ) : null}
      {msg ? <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{msg.text}</p> : null}
    </Notice>
  );
}
