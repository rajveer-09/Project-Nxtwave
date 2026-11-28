/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import {
  Banner,
  DANGER,
  DAY_TYPES,
  errText,
  fieldClass,
  fmtTime,
  ImpactSummary,
  keysOf,
  kindLabel,
  Modal,
  plural,
  rangeText,
  scopeLabel,
  SOURCE_LABEL,
  Who,
  type Msg,
} from "@nxtone/attendance-ui/components/calendar/shared";
import { fmtDate } from "@nxtone/attendance-ui/components/students/ui";
import type { CalendarDeletion, CalendarEntryRange, DayType, DeletionPreview, DeletionSelector, EntryKey, ImportBatch } from "@nxtone/attendance-ui/types";

/*
 * Calendar entry actions: details and edit, deleting entries, resetting imported entries, and the
 * deletion log with restore. Every edit and deletion is checked by the service against a token of
 * exactly the rows (and the effect) shown here; a calendar changed meanwhile gives a 409.
 */

const entries = (n: number) => plural(n, "entry", "entries");

/** Calendar changes move every percentage, sheet and report: refresh everything. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

function PreviewBody({ p }: { p: DeletionPreview }) {
  return (
    <>
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <b>{entries(p.count)}</b> on {plural(p.dates.length, "date")} ({p.dates.length ? rangeText(p.dates[0], p.dates[p.dates.length - 1]) : "–"}) · degrees:{" "}
        {p.degrees.map((d) => (d === "ALL" ? "All degrees" : d)).join(", ") || "–"} · sections: not applicable (calendar entries apply per degree) · types:{" "}
        {Object.entries(p.types)
          .map(([k, n]) => `${kindLabel(k)} ${n}`)
          .join(", ")}
      </div>
      {p.kept.manual > 0 || p.kept.legacy > 0 ? (
        <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2">
          Kept: {p.kept.manual} manual, {p.kept.legacy} legacy {p.kept.manual + p.kept.legacy === 1 ? "entry matches" : "entries match"} these filters but{" "}
          {p.kept.manual + p.kept.legacy === 1 ? "is" : "are"} not removed. A reset only removes entries from imports; delete others by selecting them in Manage entries.
        </p>
      ) : null}
      {p.missing > 0 ? <p className="text-amber-800 dark:text-amber-300">{p.missing === 1 ? "1 selected entry no longer exists." : `${p.missing} selected entries no longer exist.`}</p> : null}
      <div className="max-h-56 overflow-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Entries to be removed</caption>
          <thead className="sticky top-0 bg-surface-subtle text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-semibold">Dates</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Title</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Type</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Applies to</th>
              <th scope="col" className="px-2 py-1.5 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {p.entries.map((e) => (
              <tr key={e.applies_to + e.start} className="border-t border-border align-top">
                <td className="px-2 py-1 whitespace-nowrap">
                  {rangeText(e.start, e.end)}
                  {e.days > 1 ? <span className="text-muted-foreground"> · {e.days} days</span> : null}
                </td>
                <td className="px-2 py-1">{e.label || "No title"}</td>
                <td className="px-2 py-1">{kindLabel(e.day_type)}</td>
                <td className="px-2 py-1 whitespace-nowrap">{scopeLabel(e.applies_to)}</td>
                <td className="px-2 py-1">
                  {SOURCE_LABEL[e.source]}
                  {e.batch ? <span className="block break-all text-muted-foreground">{e.batch.file_name}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ImpactSummary impact={p.impact} />
    </>
  );
}

/**
 * Preview and confirm deleting exactly these entries (any source). Used by Manage entries and by
 * Month view's Remove, so every removal is archived and can be restored.
 * doneText: the message after a successful delete (default: the Manage entries wording).
 */
export function DeleteEntriesDialog({
  keys,
  onClose,
  onDone,
  doneText = (n) => `Deleted ${plural(n, "calendar entry", "calendar entries")}. They can be restored from the Deletion log.`,
}: {
  keys: EntryKey[] | null;
  onClose: () => void;
  onDone: (text: string) => void;
  doneText?: (deleted: number) => string;
}) {
  const open = keys !== null && keys.length > 0;
  const sel: DeletionSelector = { mode: "selected", entries: keys ?? [] };
  const preview = useQuery({
    queryKey: ["attendance", "calendar-delete-preview", JSON.stringify(sel)],
    queryFn: () => attendanceApi.previewDeletion(sel),
    enabled: open,
    gcTime: 0,
    retry: false,
  });
  const [sure, setSure] = useState(false);
  const refresh = useRefreshAll();
  const del = useMutation({
    mutationFn: () => attendanceApi.deleteEntries(sel, preview.data!.token, true),
    onSuccess: (r) => {
      void refresh();
      onDone(doneText(r.deleted));
      close();
    },
  });
  function close() {
    setSure(false);
    del.reset();
    onClose();
  }
  const p = preview.data;
  return (
    <Modal open={open} onClose={close} title="Delete calendar entries">
      {preview.isPending ? <p className="text-muted-foreground">Checking what will be deleted…</p> : null}
      {preview.error ? <Banner msg={{ ok: false, text: errText(preview.error) }} /> : null}
      {p ? (
        <>
          <PreviewBody p={p} />
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />
            <span>I have checked these entries and want to delete them. They are archived and can be restored.</span>
          </label>
          {del.error ? (
            <div className="flex flex-wrap items-center gap-2">
              <Banner msg={{ ok: false, text: errText(del.error) }} />
              <Button size="sm" variant="outline" onClick={() => (del.reset(), void preview.refetch())}>
                Check again
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button className={DANGER} disabled={!sure || p.count === 0 || del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? "Deleting…" : `Delete ${entries(p.count)}`}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

const DEGREES = ["ALL", "BITS", "CDU"];
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x]);

/** Owner only: remove entries that came from sheet imports, narrowed by uploads, degrees, types and dates. */
export function ResetImportedDialog({ initialBatch, batches, onClose, onDone }: { initialBatch?: number; batches: ImportBatch[]; onClose: () => void; onDone: (text: string) => void }) {
  const [ids, setIds] = useState<number[]>(initialBatch ? [initialBatch] : []);
  const [degrees, setDegrees] = useState<string[]>([]);
  const [types, setTypes] = useState<DayType[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [phrase, setPhrase] = useState("");
  const sel: DeletionSelector = {
    mode: "imported",
    ...(ids.length ? { batch_ids: ids } : {}),
    ...(degrees.length ? { degrees } : {}),
    ...(types.length ? { types } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const preview = useMutation({ mutationFn: () => attendanceApi.previewDeletion(sel) });
  const refresh = useRefreshAll();
  const reset = useMutation({
    mutationFn: () => attendanceApi.deleteEntries(sel, preview.data!.token, phrase),
    onSuccess: (r) => {
      void refresh();
      onDone(`Reset: removed ${plural(r.deleted, "imported calendar entry", "imported calendar entries")}. They can be restored from the Deletion log.`);
      close();
    },
  });
  const changed = () => {
    preview.reset();
    reset.reset();
    setPhrase("");
  };
  function close() {
    changed();
    onClose();
  }
  const p = preview.data;
  const want = p ? `RESET ${p.count}` : "";
  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      onClick={() => (onClick(), changed())}
      className={cn("rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", on ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-input hover:bg-muted")}
    >
      {label}
    </button>
  );
  return (
    <Modal open onClose={close} title="Reset imported calendar entries">
      <p>
        Removes calendar entries that came from <b>sheet imports</b>, so you can rebuild the calendar from correct data.{" "}
        <b>Manual and legacy entries are never removed here, and students, attendance marks, internships and registration-pending periods are never touched.</b> Leave a filter
        empty to include everything.
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">Uploads</span>
        {batches.length === 0 ? (
          <span className="text-xs text-muted-foreground">No uploads are recorded yet.</span>
        ) : (
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={ids.includes(b.id)} onChange={() => (setIds(toggle(ids, b.id)), changed())} />
                <span className="break-all">
                  #{b.id} · {b.file_name} · {fmtTime(b.uploaded_at)} · {entries(b.current_entries)} now
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">Degrees (Applies to)</span>
        <div className="flex flex-wrap gap-1.5">{DEGREES.map((d) => chip(scopeLabel(d), degrees.includes(d), () => setDegrees(toggle(degrees, d))))}</div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted-foreground">Types</span>
        <div className="flex flex-wrap gap-1.5">{DAY_TYPES.map((k) => chip(kindLabel(k), types.includes(k), () => setTypes(toggle(types, k))))}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          From
          <input type="date" className={fieldClass} value={from} onChange={(e) => (setFrom(e.target.value), changed())} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          To
          <input type="date" className={fieldClass} value={to} onChange={(e) => (setTo(e.target.value), changed())} />
        </label>
      </div>
      {!p ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => preview.mutate()} disabled={preview.isPending}>
            {preview.isPending ? "Checking…" : "Preview what will be removed"}
          </Button>
        </div>
      ) : null}
      {preview.error ? <Banner msg={{ ok: false, text: errText(preview.error) }} /> : null}
      {p && p.count === 0 ? (
        <>
          <p className="rounded-lg border border-border bg-surface-subtle px-3 py-2">No imported entries match these filters.</p>
          {p.kept.manual > 0 || p.kept.legacy > 0 ? (
            <p>
              Kept: {p.kept.manual} manual, {p.kept.legacy} legacy entries match these filters but are not removed. To delete them, select them in Manage entries.
            </p>
          ) : null}
        </>
      ) : null}
      {p && p.count > 0 ? (
        <>
          <PreviewBody p={p} />
          <label className="flex flex-col gap-1">
            <span>
              Type <b className="font-mono">{want}</b> to confirm.
            </span>
            <input className={cn(fieldClass, "w-48 font-mono uppercase")} value={phrase} onChange={(e) => setPhrase(e.target.value)} aria-label={`Type ${want} to confirm`} placeholder={want} />
          </label>
          {reset.error ? (
            <div className="flex flex-wrap items-center gap-2">
              <Banner msg={{ ok: false, text: errText(reset.error) }} />
              <Button size="sm" variant="outline" onClick={() => (reset.reset(), preview.mutate())}>
                Check again
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button className={DANGER} disabled={phrase.trim().toUpperCase() !== want || reset.isPending} onClick={() => reset.mutate()}>
              {reset.isPending ? "Removing…" : `Remove ${plural(p.count, "imported entry", "imported entries")}`}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

/** Everything about one entry range, with an in-place edit and delete. */
export function EntryDetailsDialog({
  entry,
  batch,
  onClose,
  onDelete,
  onDone,
}: {
  entry: CalendarEntryRange | null;
  batch?: ImportBatch;
  onClose: () => void;
  onDelete: (e: CalendarEntryRange) => void;
  onDone: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dayType, setDayType] = useState<DayType>("holiday");
  const [counts, setCounts] = useState(true);
  const [label, setLabel] = useState("");
  const refresh = useRefreshAll();
  const save = useMutation({
    mutationFn: () => attendanceApi.editEntries({ entries: keysOf([entry!]), token: entry!.token, day_type: dayType, counts: dayType === "event" ? counts : undefined, label }),
    onSuccess: (r) => {
      const i = r.impact;
      const effect = i.start_counting || i.stop_counting ? ` ${i.start_counting} date(s) now count and ${i.stop_counting} stop counting.` : "";
      void refresh();
      onDone(`Saved ${r.updated} date(s); the entry is now a manual entry.${effect}`);
      close();
    },
  });
  function close() {
    setEditing(false);
    save.reset();
    onClose();
  }
  const startEdit = () => {
    if (!entry) return;
    setDayType(entry.day_type);
    setCounts(entry.counts);
    setLabel(entry.label);
    setEditing(true);
  };
  const e = entry;
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-t border-border py-1.5 first:border-t-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
  return (
    <Modal open={e !== null} onClose={close} title="Calendar entry">
      {e ? (
        <>
          <dl>
            {row("Title", e.label || <span className="text-muted-foreground">No title</span>)}
            {row("Dates", `${rangeText(e.start, e.end)} · ${plural(e.days, "day")}${e.dates.length > 1 ? ` (${e.dates.map(fmtDate).join(", ")})` : ""}`)}
            {row("Type", `${kindLabel(e.day_type)}${e.day_type === "event" ? (e.counts ? " · counts toward attendance" : " · not counted") : ""}`)}
            {row("Applies to", scopeLabel(e.applies_to))}
            {row("Sections", "Not applicable: calendar entries apply per degree")}
            {row(
              "Source",
              e.source === "legacy" ? (
                "Unknown: saved before sources were recorded"
              ) : (
                <>
                  {SOURCE_LABEL[e.source]}
                  {e.batch ? (
                    <span className="block text-muted-foreground">
                      {e.batch.file_name} · upload #{e.batch.id}
                      {batch ? ` · uploaded ${fmtTime(batch.uploaded_at)} by ${batch.uploaded_by?.name || batch.uploaded_by?.email || "a removed admin"}` : ""}
                    </span>
                  ) : null}
                </>
              ),
            )}
            {row("Created", <Who at={e.created_at} by={e.created_by} unknown="Unknown (legacy)" />)}
            {row("Last updated", <Who at={e.updated_at} by={e.updated_by} unknown="Unknown (legacy)" />)}
          </dl>
          {!editing ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className="text-red-700 hover:text-red-800 dark:text-red-400" onClick={() => onDelete(e)}>
                Delete…
              </Button>
              <Button onClick={startEdit}>Edit</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Day type
                <select className={fieldClass} value={dayType} onChange={(ev) => setDayType(ev.target.value as DayType)}>
                  <option value="holiday">Holiday (not counted)</option>
                  <option value="exam">Exam (not counted)</option>
                  <option value="exam_prep">Exam preparation (not counted)</option>
                  <option value="event">Event</option>
                  <option value="working">Working (counted)</option>
                </select>
              </label>
              {dayType === "event" ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={counts} onChange={(ev) => setCounts(ev.target.checked)} />
                  Counts toward attendance
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Label
                <input className={fieldClass} value={label} maxLength={100} onChange={(ev) => setLabel(ev.target.value)} />
              </label>
              <p className="text-xs text-muted-foreground">
                Saving changes all {plural(e.days, "date")} of this entry for {scopeLabel(e.applies_to)}. It then counts as a <b>manual entry</b>, so a reset of imported
                entries will not remove it. To change the dates or the degree, delete it and add it again in Month view.
              </p>
              {save.error ? <Banner msg={{ ok: false, text: errText(save.error) }} /> : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button disabled={save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </Modal>
  );
}

function DeletionRow({ d, isOwner, onMsg }: { d: CalendarDeletion; isOwner: boolean; onMsg: (m: Msg) => void }) {
  const [open, setOpen] = useState(false);
  const refresh = useRefreshAll();
  const list = useQuery({ queryKey: ["attendance", "calendar-deletion", d.id], queryFn: () => attendanceApi.deletion(d.id), enabled: open });
  const restore = useMutation({
    mutationFn: () => attendanceApi.restoreDeletion(d.id),
    onSuccess: (r) => {
      void refresh();
      onMsg({ ok: true, text: `Restored ${entries(r.restored)}.${r.skipped ? ` ${r.skipped} not restored: a newer entry now uses that date and degree.` : ""}` });
    },
    onError: (e: Error) => onMsg({ ok: false, text: e.message }),
  });
  const dates = d.criteria.dates ?? [];
  const allBack = d.restored_entries >= d.entry_count;
  const canRestore = !allBack && (d.kind === "selected" || isOwner);
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">
            {d.kind === "imported" ? "Reset of imported entries" : "Deleted selected entries"} · {entries(d.entry_count)}
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtTime(d.deleted_at)} by {d.deleted_by?.name || d.deleted_by?.email || "a removed admin"}
            {dates.length > 0 ? <> · {rangeText(dates[0], dates[dates.length - 1])}</> : null}
            {d.criteria.degrees?.length ? <> · {d.criteria.degrees.map((x) => (x === "ALL" ? "All" : x)).join(", ")}</> : null}
          </div>
          {d.restored_entries > 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-400">
              Restored {d.restored_entries} of {d.entry_count}
              {d.restored_at ? <> · last {fmtTime(d.restored_at)} by {d.restored_by?.name || d.restored_by?.email || "a removed admin"}</> : null}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide entries" : "Show entries"}
          </Button>
          {canRestore ? (
            <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()}>
              {restore.isPending ? "Restoring…" : "Restore"}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">Entries in this deletion</caption>
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-semibold">Date</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Title</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Type</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Applies to</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">Source</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.entries ?? []).map((e) => (
                <tr key={e.date + e.applies_to} className="border-t border-border">
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-2 py-1">{e.label || "No title"}</td>
                  <td className="px-2 py-1">{kindLabel(e.day_type)}</td>
                  <td className="px-2 py-1">{scopeLabel(e.applies_to)}</td>
                  <td className="px-2 py-1">
                    {SOURCE_LABEL[e.source]}
                    {e.file_name ? <span className="block break-all text-muted-foreground">{e.file_name}</span> : null}
                  </td>
                  <td className="px-2 py-1">{e.restored ? "Restored" : "Deleted"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.isPending ? <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p> : null}
          {list.error ? <p className="px-2 py-2 text-xs text-red-700 dark:text-red-400">{list.error.message}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

/** Every deletion and reset: who, when, what; with restore. */
export function DeletionLogCard({ isOwner }: { isOwner: boolean }) {
  const log = useQuery({ queryKey: ["attendance", "calendar-deletions"], queryFn: attendanceApi.deletions });
  const [msg, setMsg] = useState<Msg>(null);
  const items = log.data?.deletions ?? [];
  return (
    <section aria-labelledby="cal-log-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 id="cal-log-h" className="text-[15px] font-bold">
          Deletion log
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Every deletion and reset of calendar entries, with who did it and exactly what was removed. <b>Restore</b> puts entries back with their original details; dates and
          degrees that have a newer entry are skipped.
          {!isOwner ? " Restoring a reset of imported entries is for the Owner." : ""}
        </p>
      </div>
      <Banner msg={msg} />
      {log.error ? <Banner msg={{ ok: false, text: log.error.message }} /> : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-[13px]">
        {items.map((d) => (
          <DeletionRow key={d.id} d={d} isOwner={isOwner} onMsg={setMsg} />
        ))}
        {log.isSuccess && items.length === 0 ? <li className="px-3 py-4 text-muted-foreground">No calendar entries have been deleted.</li> : null}
        {log.isPending ? <li className="px-3 py-4 text-muted-foreground">Loading…</li> : null}
      </ul>
    </section>
  );
}
