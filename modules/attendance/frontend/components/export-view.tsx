/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/common/components/empty-state";
import { PageHeader } from "@/common/components/page-header";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { addDays, formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import type { AttendanceExport, ExportDegree } from "@nxtone/attendance-ui/types";
import { Notice, control } from "./import-ui";

/*
 * Backup export for the team's master sheet (ported from the attendance dashboard): the saved
 * attendance for a day (or a few days), one block per degree, in the same row order as the
 * student import file. Copy pastes just the date columns, so it drops straight into the sheet's
 * date column starting at row 2.
 */

function valueTone(v: string) {
  switch (v) {
    case "Present":
    case "Internship Period":
      return "text-emerald-700 dark:text-emerald-300";
    case "Absent":
    case "Term 5 Registration Pending":
      return "text-red-700 dark:text-red-300";
    default:
      return "text-muted-foreground";
  }
}

/** Tab-separated values only (no IDs or names), one line per student. */
const valuesTSV = (deg: ExportDegree) => deg.rows.map((r) => r.values.join("\t")).join("\n");

/** `embedded` drops the page header when the view sits inside the Attendance data tabs. */
export function ExportView({ embedded = false }: { embedded?: boolean } = {}) {
  // Blank means "today" (IST, decided by the service).
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["attendance", "export", from, range ? to : from], queryFn: () => attendanceApi.exportAttendance(from, range ? to : from) });
  const data = q.data;
  const today = data?.today ?? "";
  const shownFrom = from || data?.from || "";
  const shownTo = (range ? to : from) || data?.to || shownFrom;

  const pickDay = (day: string) => {
    setRange(false);
    setFrom(day);
    setTo("");
  };

  async function download() {
    setBusy(true);
    try {
      const { blob, name } = await attendanceApi.exportExcel(shownFrom, shownTo);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  const span = data ? (data.from === data.to ? formatDate(data.from) : `${formatDate(data.from)} – ${formatDate(data.to)}`) : "";
  const unmarked = data?.degrees.reduce((n, d) => n + d.unmarked, 0) ?? 0;

  const downloadButton = (
    <Button className="h-10 px-4" onClick={download} disabled={!data || busy}>
      <FileSpreadsheet className="size-4" /> {busy ? "Preparing…" : "Download Excel"}
    </Button>
  );
  const blurb = "Download or copy the saved attendance, in your master sheet's row order, as a backup.";

  return (
    <div className="flex flex-col gap-5">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{blurb}</p>
          {downloadButton}
        </div>
      ) : (
        <PageHeader eyebrow="Admin panel" title="Attendance export" description={blurb} actions={downloadButton} />
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" aria-label="Dates to export">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {range ? "From" : "Date"}
            <input type="date" className={control} value={shownFrom} max={today || undefined} onChange={(e) => setFrom(e.target.value)} aria-label={range ? "From date" : "Date"} />
          </label>
          {range ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              To
              <input type="date" className={control} value={shownTo} min={shownFrom || undefined} max={today || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {today ? (
              <>
                <Chip on={!range && shownFrom === today} onClick={() => pickDay(today)}>
                  Today
                </Chip>
                <Chip on={!range && shownFrom === addDays(today, -1)} onClick={() => pickDay(addDays(today, -1))}>
                  Yesterday
                </Chip>
              </>
            ) : null}
            <Chip
              on={range}
              onClick={() => {
                if (range) {
                  setRange(false);
                  setTo("");
                } else {
                  setRange(true);
                  setFrom(shownFrom);
                  setTo(shownTo);
                }
              }}
            >
              Several days
            </Chip>
          </div>
        </div>
        {data ? (
          <p className="text-sm text-muted-foreground">
            {span}: one column per date ({data.headers.join(", ")}). Excel has one tab per degree.
          </p>
        ) : null}
        {unmarked > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-warning">
            <TriangleAlert className="size-4" /> {unmarked.toLocaleString("en-IN")} class {unmarked === 1 ? "day is" : "days are"} not marked yet; those cells will be blank.
          </p>
        ) : null}
      </section>

      {q.isLoading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : q.isError ? (
        <EmptyState title="Couldn't load the export" description={q.error.message} />
      ) : data ? (
        <>
          {data.degrees
            .filter((d) => d.rows.length > 0)
            .map((d) => (
              <DegreeBlock key={d.degree} deg={d} data={data} />
            ))}
          {data.degrees.every((d) => d.rows.length === 0) ? <EmptyState title="No students yet" description="Import students first, from Attendance imports." /> : null}
        </>
      ) : null}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full px-3 text-xs font-semibold ring-1 ring-inset transition-colors",
        on ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-input hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function DegreeBlock({ deg, data }: { deg: ExportDegree; data: AttendanceExport }) {
  const [copied, setCopied] = useState(false);
  const first = deg.rows[0];
  const last = deg.rows[deg.rows.length - 1];

  async function copy() {
    try {
      await navigator.clipboard.writeText(valuesTSV(deg));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("The browser blocked copying. Use Download Excel instead.");
    }
  }

  return (
    <SectionCard
      title={`${deg.degree} · ${deg.rows.length.toLocaleString("en-IN")} students`}
      description={
        <>
          Check before pasting: row 2 is <span className="font-mono">{first.niat_id}</span>, the last row ({deg.rows.length + 1}) is <span className="font-mono">{last.niat_id}</span>.
        </>
      }
      action={
        <Button variant="outline" className="h-10" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : `Copy ${data.headers.length > 1 ? "columns" : "column"}`}
        </Button>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        In your {deg.degree} tab, click row 2 of the <span className="font-semibold text-foreground">{data.headers[0]}</span> column and paste.
      </p>
      {deg.unordered > 0 ? (
        <Notice tone="amber" className="flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {deg.unordered.toLocaleString("en-IN")} {deg.unordered === 1 ? "student has" : "students have"} no row position from a student import, so {deg.unordered === 1 ? "it is" : "they are"}{" "}
            listed last and may not line up with your sheet. Re-import the {deg.degree} student file to fix the order.
          </span>
        </Notice>
      ) : null}
      {deg.unmarked > 0 ? (
        <p className="text-sm text-warning">
          {deg.unmarked.toLocaleString("en-IN")} class {deg.unmarked === 1 ? "day" : "days"} not marked yet in {deg.degree}.
        </p>
      ) : null}
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-subtle text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Row</th>
              <th className="px-3 py-2.5 font-medium">NIAT ID</th>
              <th className="px-3 py-2.5 font-medium">Student Full Name</th>
              <th className="px-3 py-2.5 font-medium">Section</th>
              {data.headers.map((h) => (
                <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deg.rows.map((r, i) => (
              <tr key={r.niat_id} className="border-t border-border">
                <td className="px-3 py-1.5 text-muted-foreground tabular">{i + 2}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{r.niat_id}</td>
                <td className="px-3 py-1.5">
                  {r.name}
                  {r.dropped ? <span className="ml-1.5 text-xs text-muted-foreground">(dropped)</span> : null}
                </td>
                <td className="px-3 py-1.5">{r.section}</td>
                {r.values.map((v, j) => (
                  <td key={data.dates[j]} className={cn("px-3 py-1.5 whitespace-nowrap", valueTone(v))}>
                    {v || "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
