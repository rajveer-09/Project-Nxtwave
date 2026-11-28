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
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { ImportResult } from "@nxtone/attendance-ui/types";
import { AttendancePreview, ConfirmRow, attendanceHasErrors, periodsSaved, type ValueMap } from "./import-attendance";
import { ACTION, Badge, Count, FilePicker, Notice, RowNotes, SampleLink, tableWrap, td, th, theadRow } from "./import-ui";

/**
 * Upload a students sheet, preview row-level results, then confirm to save (ported from the
 * attendance dashboard). When the sheet also has date columns, the same preview shows its marks
 * and the same confirm saves them.
 */
export function ImportStudents() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
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
    mutationFn: (v: { file: File; columnDates: Record<number, string>; valueMap: ValueMap }) => attendanceApi.importStudents(v.file, { columnDates: v.columnDates, valueMap: v.valueMap }),
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
    mutationFn: () => attendanceApi.importStudents(file!, { commit: true, skipErrors, columnDates, valueMap }),
    onSuccess: (res) => {
      const marks = res.attendance ? ` Saved ${res.attendance.saved} mark(s) for ${res.attendance.summary.students_affected} student(s)${periodsSaved(res.attendance.summary.periods_to_save)}.` : "";
      setDone(
        `Imported ${res.file_name}: ${res.summary.new} new, ${res.summary.updated} updated${res.summary.reordered ? `, row order saved for ${res.summary.reordered} more` : ""}${
          res.summary.errors ? `, ${res.summary.errors} row(s) with errors skipped` : ""
        }.${marks}`,
      );
      reset();
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const s = preview?.summary;
  const att = preview?.attendance;
  const studentsToSave = s ? s.new + s.updated : 0;
  const marksToSave = att?.summary.records_to_update ?? 0;
  const periodsToSave = att?.summary.periods_to_save ?? 0;
  // Unchanged students whose row position (used by Export) would change.
  const orderOnly = s?.reordered ?? 0;
  const partial = !!att && att.unsupported.length > 0;
  const hasErrors = !!s && (s.errors > 0 || (!!att && attendanceHasErrors(att)));
  const error = check.error ?? save.error;
  const saveLabel = [
    studentsToSave > 0 && `${studentsToSave} student${studentsToSave === 1 ? "" : "s"}`,
    marksToSave > 0 && `${marksToSave} mark${marksToSave === 1 ? "" : "s"}`,
    periodsToSave > 0 && `${periodsToSave} period${periodsToSave === 1 ? "" : "s"}`,
    orderOnly > 0 && `row order for ${orderOnly} student${orderOnly === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <SectionCard
      title="Import students"
      description={
        <>
          Upload the attendance sheet (.xlsx or .csv) with columns NIAT ID, Student Name, Degree, Section, Hall No., Level, then one column per date (19-Aug-2026). Date cells: Present,
          Absent, P, A, 1 or 0; blank changes nothing. Students and their marks are previewed and saved in one step. Existing students are matched by NIAT ID; blank Hall No. or Level cells
          keep the saved values. <SampleLink kind="students" />
        </>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilePicker
          inputRef={inputRef}
          file={file}
          label="Student sheet"
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
            {check.isPending ? "Checking…" : "Check file"}
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
          <div className="flex flex-wrap gap-2">
            <Count label="Rows" n={s.total} tone="neutral" />
            <Count label="New" n={s.new} tone="green" />
            <Count label="Update" n={s.updated} tone="blue" />
            <Count label="Unchanged" n={s.unchanged} tone="neutral" />
            <Count label="Errors" n={s.errors} tone="red" />
            {s.warnings > 0 ? <Count label="Warnings" n={s.warnings} tone="amber" /> : null}
            {orderOnly > 0 ? <Count label="Row order" n={orderOnly} tone="sky" /> : null}
          </div>

          <div className={tableWrap}>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Row</th>
                  <th className={th}>NIAT ID</th>
                  <th className={th}>Name</th>
                  <th className={th}>Degree / Section</th>
                  <th className={th}>Result</th>
                  <th className={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={`border-t border-border align-top ${r.action === "error" ? "bg-red-50/40 dark:bg-red-950/20" : ""}`}>
                    <td className={`${td} text-muted-foreground tabular`}>{r.row}</td>
                    <td className={`${td} font-mono text-xs`}>{r.niat_id || "—"}</td>
                    <td className={td}>
                      {r.action === "update" || r.action === "unchanged" ? (
                        <Link href={`/students/${r.niat_id}`} target="_blank" className="font-semibold hover:text-primary hover:underline">
                          {r.name || r.niat_id}
                        </Link>
                      ) : (
                        r.name || "—"
                      )}
                    </td>
                    <td className={td}>
                      {r.degree || "—"} / {r.section || "—"}
                    </td>
                    <td className={td}>
                      <Badge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</Badge>
                    </td>
                    <td className={`${td} text-xs`}>
                      <RowNotes errors={r.errors} warnings={r.warnings} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {att ? (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">DSA attendance in this sheet</h3>
              <AttendancePreview source="students" preview={att} columnDates={columnDates} onColumnDates={recheck} valueMap={valueMap} onValueMap={remap} />
            </div>
          ) : null}

          <ConfirmRow
            hasErrors={hasErrors}
            skipErrors={skipErrors}
            onSkipErrors={setSkipErrors}
            partial={partial}
            disabled={!saveLabel || (hasErrors && !skipErrors) || save.isPending}
            onCancel={reset}
            onConfirm={() => save.mutate()}
            label={save.isPending ? "Importing…" : !saveLabel ? "Nothing to import" : partial ? `Continue with valid data: import ${saveLabel}` : `Import ${saveLabel}`}
          />
        </>
      ) : null}
    </SectionCard>
  );
}
