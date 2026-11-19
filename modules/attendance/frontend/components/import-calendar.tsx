/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { formatDate } from "@/common/lib/dates";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { CalendarImportResult } from "@nxtone/attendance-ui/types";
import { ConfirmRow } from "./import-attendance";
import { ACTION, Badge, Count, FilePicker, Notice, RowNotes, SampleLink, tableWrap, td, th, theadRow } from "./import-ui";

const TYPE_LABEL: Record<string, string> = { working: "Working", holiday: "Holiday", exam: "Exam", exam_prep: "Exam preparation", event: "Event" };

/** Calendar sheet import (ported from the attendance dashboard). Entries are matched by date and Applies To. */
export function ImportCalendar() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CalendarImportResult | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [done, setDone] = useState("");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSkipErrors(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  const check = useMutation({ mutationFn: (f: File) => attendanceApi.importCalendar(f), onSuccess: setPreview });
  const save = useMutation({
    mutationFn: () => attendanceApi.importCalendar(file!, { commit: true, skipErrors }),
    onSuccess: (res) => {
      setDone(`Imported ${res.file_name}: ${res.summary.new} new, ${res.summary.updated} updated${res.summary.errors ? `, ${res.summary.errors} row(s) with errors skipped` : ""}.`);
      reset();
      // Calendar entries change which days count, so refresh every attendance view.
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const s = preview?.summary;
  const toSave = s ? s.new + s.updated : 0;
  const error = check.error ?? save.error;

  return (
    <SectionCard
      title="Import calendar"
      description={
        <>
          Upload a .xlsx or .csv file (max 10 MB) with columns Date, Day Type (Working, Holiday, Exam or Event), Applies To (All, BITS or CDU), Label and optional Counts (Yes/No, for
          events). Entries are matched by date and Applies To, so uploading the same file again changes nothing. Attendance marks are never deleted. <SampleLink kind="calendar" />
        </>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilePicker
          inputRef={inputRef}
          file={file}
          label="Calendar sheet"
          onPick={(f) => {
            setFile(f);
            setPreview(null);
            setDone("");
            check.reset();
            save.reset();
          }}
        />
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 px-4" disabled={!file || check.isPending} onClick={() => file && check.mutate(file)}>
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
          </div>

          <div className={tableWrap}>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Row</th>
                  <th className={th}>Date</th>
                  <th className={th}>Type</th>
                  <th className={th}>Applies to</th>
                  <th className={th}>Label</th>
                  <th className={th}>Result</th>
                  <th className={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={`border-t border-border align-top ${r.action === "error" ? "bg-red-50/40 dark:bg-red-950/20" : ""}`}>
                    <td className={`${td} text-muted-foreground tabular`}>{r.row}</td>
                    <td className={`${td} whitespace-nowrap`}>{/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? formatDate(r.date) : r.date || "—"}</td>
                    <td className={td}>
                      {TYPE_LABEL[r.day_type] ?? (r.day_type || "—")}
                      {r.day_type === "event" ? <span className="text-xs text-muted-foreground"> ({r.counts ? "counts" : "not counted"})</span> : null}
                    </td>
                    <td className={td}>{r.applies_to === "ALL" ? "All" : r.applies_to || "—"}</td>
                    <td className={td}>{r.label || "—"}</td>
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

          <ConfirmRow
            hasErrors={s.errors > 0}
            skipErrors={skipErrors}
            onSkipErrors={setSkipErrors}
            partial={false}
            skipText={`Skip the ${s.errors} row(s) with errors and import the rest`}
            disabled={toSave === 0 || (s.errors > 0 && !skipErrors) || save.isPending}
            onCancel={reset}
            onConfirm={() => save.mutate()}
            label={save.isPending ? "Importing…" : toSave === 0 ? "Nothing to import" : `Import ${toSave} entr${toSave === 1 ? "y" : "ies"}`}
          />
        </>
      ) : null}
    </SectionCard>
  );
}
