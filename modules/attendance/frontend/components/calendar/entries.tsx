/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { DeleteEntriesDialog, EntryDetailsDialog, ResetImportedDialog } from "@nxtone/attendance-ui/components/calendar/actions";
import { Banner, DANGER, DAY_TYPES, dayOf, fieldClass, fmtTime, KIND_INFO, keysOf, LEGACY, plural, rangeText, scopeLabel, SOURCE_LABEL, Who, type Msg } from "@nxtone/attendance-ui/components/calendar/shared";
import { fmtDate } from "@nxtone/attendance-ui/components/students/ui";
import type { CalendarEntryRange, EntryKey, ImportBatch } from "@nxtone/attendance-ui/types";

/*
 * Calendar entries with where they came from, and the uploads that wrote them. Filtering happens
 * here over the service's grouped list; every deletion is previewed by the service first.
 */

const BATCH_KIND: Record<string, string> = {
  calendar: "Calendar import",
  attendance: "Attendance import: dates with no column",
  students: "Students import: dates with no column",
};

function Filter({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground", wide && "sm:col-span-2")}>
      {label}
      {children}
    </label>
  );
}

const EMPTY = { q: "", degree: "", type: "", source: "", from: "", to: "", changed: "updated" as "created" | "updated", changedFrom: "", changedTo: "" };

function Panel({ id, title, description, children }: { id: string; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 id={id} className="text-[15px] font-bold">
          {title}
        </h2>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Every saved calendar entry, grouped into date ranges, with filters. */
export function CalendarEntriesCard({ batch, onBatch, isOwner }: { batch: string; onBatch: (id: string) => void; isOwner: boolean }) {
  const list = useQuery({ queryKey: ["attendance", "calendar-entries"], queryFn: attendanceApi.calendarEntries });
  const history = useQuery({ queryKey: ["attendance", "import-history"], queryFn: attendanceApi.importHistory });
  const [f, setF] = useState(EMPTY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<CalendarEntryRange | null>(null);
  const [deleting, setDeleting] = useState<EntryKey[] | null>(null);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const keyOf = (e: CalendarEntryRange) => `${e.applies_to}|${e.start}`;
  const done = (text: string) => {
    setMsg({ ok: true, text });
    setSelected(new Set());
    setDetails(null);
  };
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const all = list.data?.entries ?? [];
  const degrees = [...new Set(all.map((e) => e.applies_to))].sort((a, b) => (a === "ALL" ? -1 : b === "ALL" ? 1 : a.localeCompare(b)));
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter((e) => {
    if (f.degree && e.applies_to !== f.degree) return false;
    if (f.type && e.day_type !== f.type) return false;
    if (f.source === "imported" ? !e.source.endsWith("_import") : f.source && e.source !== f.source) return false;
    if (batch && String(e.batch?.id ?? "") !== batch) return false;
    if (f.from && e.end < f.from) return false;
    if (f.to && e.start > f.to) return false;
    const at = f.changed === "created" ? e.created_at : e.updated_at;
    if ((f.changedFrom || f.changedTo) && !at) return false;
    if (at && f.changedFrom && dayOf(at) < f.changedFrom) return false;
    if (at && f.changedTo && dayOf(at) > f.changedTo) return false;
    const text = [e.label, e.batch?.file_name, e.created_by?.name, e.updated_by?.name, SOURCE_LABEL[e.source]].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const filtered = JSON.stringify(f) !== JSON.stringify(EMPTY) || batch !== "";
  const days = rows.reduce((n, e) => n + e.days, 0);
  const picked = all.filter((e) => selected.has(keyOf(e)));
  const allShown = rows.length > 0 && rows.every((e) => selected.has(keyOf(e)));
  const toggleRow = (e: CalendarEntryRange) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(keyOf(e))) next.delete(keyOf(e));
      else next.add(keyOf(e));
      return next;
    });
  const toggleShown = () =>
    setSelected((cur) => {
      const next = new Set(cur);
      for (const e of rows) {
        if (allShown) next.delete(keyOf(e));
        else next.add(keyOf(e));
      }
      return next;
    });
  const batches = history.data?.batches ?? [];

  return (
    <Panel
      id="cal-entries-h"
      title="Manage calendar entries"
      description="Every saved holiday, exam, exam preparation, event and working-day entry, with where it came from. Consecutive days saved together are shown as one range. Click an entry's title for its details, to edit or delete it; tick entries to delete several at once."
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Filter label="Search">
          <input className={fieldClass} value={f.q} onChange={set("q")} placeholder="Title, file name or admin" />
        </Filter>
        <Filter label="Degree">
          <select className={fieldClass} value={f.degree} onChange={set("degree")}>
            <option value="">All scopes</option>
            {degrees.map((d) => (
              <option key={d} value={d}>
                {scopeLabel(d)}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Type">
          <select className={fieldClass} value={f.type} onChange={set("type")}>
            <option value="">All types</option>
            {DAY_TYPES.map((k) => (
              <option key={k} value={k}>
                {KIND_INFO[k].label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Source">
          <select className={fieldClass} value={f.source} onChange={set("source")}>
            <option value="">All sources</option>
            <option value="manual">Manual entry</option>
            <option value="imported">Imported (any sheet)</option>
            <option value="calendar_import">Calendar import</option>
            <option value="attendance_import">Attendance import</option>
            <option value="students_import">Students import</option>
            <option value="legacy">{LEGACY}</option>
          </select>
        </Filter>
        <Filter label="Import batch">
          <select className={fieldClass} value={batch} onChange={(e) => onBatch(e.target.value)}>
            <option value="">All uploads</option>
            {batches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                #{b.id} · {b.file_name} · {fmtTime(b.uploaded_at)}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Entry dates from">
          <input type="date" className={fieldClass} value={f.from} onChange={set("from")} />
        </Filter>
        <Filter label="Entry dates to">
          <input type="date" className={fieldClass} value={f.to} onChange={set("to")} />
        </Filter>
        <Filter label="Saved on (IST)" wide>
          <div className="grid grid-cols-[7rem_1fr_1fr] gap-1">
            <select className={fieldClass} value={f.changed} onChange={set("changed")} aria-label="Created or last updated">
              <option value="updated">Updated</option>
              <option value="created">Created</option>
            </select>
            <input type="date" className={fieldClass} value={f.changedFrom} onChange={set("changedFrom")} aria-label="Saved from" />
            <input type="date" className={fieldClass} value={f.changedTo} onChange={set("changedTo")} aria-label="Saved to" />
          </div>
        </Filter>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} of {plural(all.length, "entry", "entries")} ({plural(days, "day")}){batch ? <> · upload #{batch}</> : null}. Entries apply per degree; sections
          are not supported. Internships are not calendar entries: see the Internships table in Month view.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!filtered}
          onClick={() => {
            setF(EMPTY);
            onBatch("");
          }}
        >
          Clear filters
        </Button>
      </div>

      <Banner msg={msg} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className={DANGER}
          disabled={picked.length === 0}
          onClick={() => {
            setMsg(null);
            setDeleting(keysOf(picked));
          }}
        >
          Delete selected ({picked.reduce((n, e) => n + e.days, 0)})
        </Button>
        {picked.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        ) : null}
        {isOwner ? (
          <Button
            size="sm"
            variant="outline"
            className="sm:ml-auto"
            onClick={() => {
              setMsg(null);
              setResetting(true);
            }}
          >
            Reset imported entries…
          </Button>
        ) : null}
      </div>
      {list.error ? <Banner msg={{ ok: false, text: list.error.message }} /> : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <caption className="sr-only">Calendar entries</caption>
          <thead className="bg-surface-subtle text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-3 py-2">
                <input type="checkbox" aria-label="Select all shown entries" checked={allShown} onChange={toggleShown} disabled={rows.length === 0} />
              </th>
              {["Dates", "Title", "Type", "Applies to", "Source", "Created", "Last updated"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <EntryRow key={keyOf(e)} e={e} checked={selected.has(keyOf(e))} onCheck={() => toggleRow(e)} onOpen={() => setDetails(e)} />
            ))}
          </tbody>
        </table>
        {list.isSuccess && rows.length === 0 ? <p className="px-3 py-4 text-[13px] text-muted-foreground">{all.length ? "No entries match these filters." : "No calendar entries saved yet."}</p> : null}
        {list.isPending ? <p className="px-3 py-4 text-[13px] text-muted-foreground">Loading…</p> : null}
      </div>
      <EntryDetailsDialog
        entry={details}
        batch={batches.find((b) => b.id === details?.batch?.id)}
        onClose={() => setDetails(null)}
        onDelete={(e) => {
          setDetails(null);
          setDeleting(keysOf([e]));
        }}
        onDone={done}
      />
      <DeleteEntriesDialog keys={deleting} onClose={() => setDeleting(null)} onDone={done} />
      {isOwner && resetting ? <ResetImportedDialog batches={batches} onClose={() => setResetting(false)} onDone={done} /> : null}
    </Panel>
  );
}

function EntryRow({ e, checked, onCheck, onOpen }: { e: CalendarEntryRange; checked: boolean; onCheck: () => void; onOpen: () => void }) {
  const info = KIND_INFO[e.day_type] ?? KIND_INFO.working;
  const span = Math.round((Date.parse(e.end) - Date.parse(e.start)) / 86_400_000) + 1;
  return (
    <tr className={cn("border-t border-border align-top", checked && "bg-red-50/40 dark:bg-red-950/20")}>
      <td className="px-3 py-2">
        <input type="checkbox" aria-label={`Select ${e.label || "entry"}, ${rangeText(e.start, e.end)}, ${scopeLabel(e.applies_to)}`} checked={checked} onChange={onCheck} />
      </td>
      <td className="px-3 py-2">
        <div className="whitespace-nowrap">{rangeText(e.start, e.end)}</div>
        <div className="text-xs text-muted-foreground">
          {plural(e.days, "day")}
          {span > e.days ? " (Sundays not included)" : ""}
        </div>
      </td>
      <td className="px-3 py-2 break-words">
        <button type="button" onClick={onOpen} className="text-left font-semibold text-primary hover:underline">
          {e.label || "No title"}
        </button>
        {e.day_type === "event" ? <div className="mt-0.5 text-xs text-muted-foreground">{e.counts ? "Counts" : "Not counted"}</div> : null}
      </td>
      <td className="px-3 py-2">
        <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset", info.chip)}>{info.label}</span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{scopeLabel(e.applies_to)}</td>
      <td className="px-3 py-2">
        <div className={e.source === "legacy" ? "text-muted-foreground" : ""}>{SOURCE_LABEL[e.source]}</div>
        {e.batch ? (
          <div className="text-xs text-muted-foreground">
            <span className="break-all">{e.batch.file_name}</span> · upload #{e.batch.id}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <Who at={e.created_at} by={e.created_by} unknown="Unknown (legacy)" />
      </td>
      <td className="px-3 py-2">
        <Who at={e.updated_at} by={e.updated_by} unknown="Unknown (legacy)" />
      </td>
    </tr>
  );
}

function batchStatus(b: ImportBatch) {
  if (b.status !== "committed") return b.status;
  const base = b.summary.created + b.summary.updated ? "Saved" : "No changes";
  return b.summary.skipped ? `${base}, ${plural(b.summary.skipped, "row")} skipped (errors)` : base;
}

/** Uploads that wrote calendar entries, newest first. */
export function ImportHistoryCard({ onView, isOwner }: { onView: (id: number) => void; isOwner: boolean }) {
  const history = useQuery({ queryKey: ["attendance", "import-history"], queryFn: attendanceApi.importHistory });
  const batches = history.data?.batches ?? [];
  const [resetBatch, setResetBatch] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <Panel
      id="cal-history-h"
      title="Import history"
      description={
        <>
          Each saved upload that created or updated calendar entries: calendar sheets, and dates with no column saved from an attendance or students sheet. Uploads saved
          before this history was added are not listed; their entries show as &ldquo;{LEGACY}&rdquo;.
        </>
      }
    >
      <Banner msg={msg} />
      {history.error ? <Banner msg={{ ok: false, text: history.error.message }} /> : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <caption className="sr-only">Uploads that wrote calendar entries</caption>
          <thead className="bg-surface-subtle text-xs text-muted-foreground">
            <tr>
              {["File", "Uploaded", "Created", "Updated", "Date range", "Degrees", "Status", "Entries"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold break-all">{b.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {BATCH_KIND[b.kind] ?? b.kind} · upload #{b.id}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Who at={b.uploaded_at} by={b.uploaded_by} unknown="" />
                </td>
                <td className="px-3 py-2 tabular">{b.summary.created}</td>
                <td className="px-3 py-2 tabular">{b.summary.updated}</td>
                <td className="px-3 py-2 whitespace-nowrap">{b.summary.from ? (b.summary.from === b.summary.to ? fmtDate(b.summary.from) : rangeText(b.summary.from, b.summary.to!)) : "–"}</td>
                <td className="px-3 py-2">{b.summary.degrees.length ? b.summary.degrees.map((d) => (d === "ALL" ? "All" : d)).join(", ") : "–"}</td>
                <td className="px-3 py-2">{batchStatus(b)}</td>
                <td className="px-3 py-2">
                  {b.current_entries > 0 ? (
                    <div className="flex flex-col items-start gap-1">
                      <Button size="sm" variant="outline" onClick={() => onView(b.id)}>
                        View {plural(b.current_entries, "entry", "entries")}
                      </Button>
                      {isOwner ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:underline dark:text-red-400"
                          onClick={() => {
                            setMsg(null);
                            setResetBatch(b.id);
                          }}
                        >
                          Remove these entries…
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{b.summary.created + b.summary.updated ? "None now: changed or removed later" : "None"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.isSuccess && batches.length === 0 ? <p className="px-3 py-4 text-[13px] text-muted-foreground">No uploads have written calendar entries since this history was added.</p> : null}
        {history.isPending ? <p className="px-3 py-4 text-[13px] text-muted-foreground">Loading…</p> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Calendar entries apply per degree (All, BITS, CDU); sections are not part of calendar entries. &ldquo;Entries&rdquo; counts the entries that still come from that upload: a
        later save of the same date and degree moves the entry to the newer source.
      </p>
      {isOwner && resetBatch !== null ? (
        <ResetImportedDialog key={resetBatch} initialBatch={resetBatch} batches={batches} onClose={() => setResetBatch(null)} onDone={(text) => setMsg({ ok: true, text })} />
      ) : null}
    </Panel>
  );
}
