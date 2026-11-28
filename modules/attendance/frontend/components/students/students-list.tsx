/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { RangePicker } from "@nxtone/attendance-ui/components/students/date-range";
import { StudentFormCard } from "@nxtone/attendance-ui/components/students/student-form";
import {
  BAND_INFO,
  BAND_ORDER,
  byHall,
  DANGER_BUTTON,
  DemoPill,
  fmtDate,
  fmtDay,
  hallLabel,
  inputClass,
  isBand,
  NOTICE,
  PctBadge,
  pctText,
  refreshAttendance,
  selectClass,
  studentHref,
  TermPicker,
  TermRange,
  useTermParam,
  type BandKey,
} from "@nxtone/attendance-ui/components/students/ui";
import type { AdminStudent } from "@nxtone/attendance-ui/types";

/** Select value for "students with no hall" ("" already means all halls; the service uses hall=""). */
const NO_HALL = "__none__";

/** Every student for the chosen term: the summary cards and filter choices never follow the filters. */
function useAllStudents() {
  const term = useTermParam();
  return useQuery({ queryKey: ["attendance", "students", "all", term], queryFn: () => attendanceApi.students({ term }) });
}

/**
 * DSA attendance › Students: every student's attendance for the term (or chosen dates), with
 * search, filters and band cards, all kept in the URL. Owners and admins add and edit students;
 * only the Owner deletes them.
 */
export function StudentsList({ isOwner }: { isOwner: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const band = isBand(params.get("band")) ? (params.get("band") as BandKey) : null;
  const degree = params.get("degree") ?? "";
  const section = params.get("section") ?? "";
  const hall = params.has("hall") ? (params.get("hall") ?? "") : undefined;
  const presentToday = params.get("present") === "today";
  const term = params.get("term") ?? "";
  // The search box and the dates keep their own state so typing stays smooth and changing From
  // then To at once never loses a value; the URL follows them.
  const [q, setQ] = useState(params.get("q") ?? "");
  const [dates, setDates] = useState({ from: params.get("from") ?? "", to: params.get("to") ?? "" });
  const [adding, setAdding] = useState(false);
  // Owner only: NIAT IDs ticked for bulk delete, kept across searches and filters on purpose.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const all = useAllStudents();
  const { from, to } = dates;
  const ranged = from !== "" && to !== "" && from <= to;
  const filters = { q: q.trim(), degree, section, hall, presentToday, term, ...(ranged ? { from, to } : {}) };
  const list = useQuery({
    queryKey: ["attendance", "students", "list", filters],
    queryFn: () => attendanceApi.students(filters),
    placeholderData: (prev) => prev,
  });
  const total = all.data?.overview.students ?? 0;
  // Band filtering happens here, over the band the service returned for each row.
  const rows = (list.data?.students ?? []).filter((s) => !band || s.band === band);
  const filtered = q !== "" || band !== null || degree !== "" || section !== "" || hall !== undefined || presentToday || from !== "" || to !== "";

  const everyone = all.data?.students ?? [];
  const degrees = [...new Set(everyone.map((s) => s.degree))].sort();
  const sections = [...new Set(everyone.filter((s) => !degree || s.degree === degree).map((s) => s.section))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const halls = [...new Set(everyone.map((s) => s.hall_no))].sort(byHall);
  const demoCount = everyone.filter((s) => s.demo).length;
  const t = all.data?.term ?? null;
  const today = all.data?.today ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Students</h2>
          <p className="text-[13px] text-muted-foreground">
            {all.data ? (
              <>
                {t ? <TermRange term={t} /> : "No current term"} · data up to {fmtDay(t && t.end < today ? t.end : today)}
              </>
            ) : (
              "…"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TermPicker />
          <Button onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <UserPlus /> {adding ? "Close" : "Add student"}
          </Button>
        </div>
      </div>

      {adding ? <StudentFormCard onDone={() => setAdding(false)} /> : null}

      <SummaryCards data={all.data?.overview} band={band} onBand={(b) => setParam({ band: band === b ? null : b })} />

      {all.error ? <p className={NOTICE.error}>{all.error.message}</p> : null}

      <section aria-labelledby="att-students-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h3 id="att-students-h" className="text-[15px] font-bold">
            All students
          </h3>
          <p className="text-[13px] text-muted-foreground">Search by name or NIAT ID, filter, or pick a band above. Click a student to see everything they see.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <input
            type="search"
            className={inputClass}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setParam({ q: e.target.value || null });
            }}
            placeholder="Search by name or NIAT ID"
            aria-label="Search students"
          />
          <FilterSelect label="Degree" all="All degrees" value={degree} onChange={(v) => setParam({ degree: v || null, section: null })}>
            {degrees.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Section" all="All sections" value={section} onChange={(v) => setParam({ section: v || null })}>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Hall" all="All halls" value={hall === undefined ? "" : hall || NO_HALL} onChange={(v) => setParam({ hall: v === "" ? null : v === NO_HALL ? "" : v })}>
            {halls.map((h) => (
              <option key={h || NO_HALL} value={h || NO_HALL}>
                {hallLabel(h)}
              </option>
            ))}
          </FilterSelect>
          <Button variant={presentToday ? "default" : "outline"} className="h-9" aria-pressed={presentToday} onClick={() => setParam({ present: presentToday ? null : "today" })}>
            <UserCheck /> Present today
          </Button>
          <Button
            variant="outline"
            className="h-9"
            disabled={!filtered}
            onClick={() => {
              setQ("");
              setDates({ from: "", to: "" });
              router.replace(pathname, { scroll: false });
            }}
          >
            Clear filters
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-subtle p-3">
          <span className="text-xs font-semibold text-sidebar-foreground">Attendance dates</span>
          <RangePicker
            from={from}
            to={to}
            today={today}
            term={t}
            onChange={(f, tt) => {
              setDates({ from: f, to: tt });
              setParam({ from: f || null, to: tt || null });
            }}
          />
          <span className="text-xs text-muted-foreground">
            {ranged
              ? `Counts from ${fmtDate(from)} to ${fmtDate(to)}: working days = present + absent. Class days with no mark are not counted.`
              : from || to
                ? "Choose both dates (To on or after From)."
                : "Leave empty for the whole term."}
          </span>
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {presentToday && list.isSuccess ? (
            <>
              <b className="font-semibold text-foreground">
                {rows.length} present today{today ? ` (${fmtDate(today)})` : ""}
              </b>
              {" · "}
            </>
          ) : null}
          Showing {rows.length} of {total} students
          {band ? <> · band: {BAND_INFO[band].label}</> : null}
          {q ? <> · search: “{q}”</> : null}
          {demoCount > 0 ? <> · includes {demoCount} demo students (N99…)</> : null}
        </p>

        {list.error ? <p className={NOTICE.error}>{list.error.message}</p> : null}
        {isOwner && selected.size > 0 ? <BulkDeleteBar ids={[...selected]} onClear={() => setSelected(new Set())} /> : null}
        <StudentRows rows={rows} term={term} selection={isOwner ? { selected, onChange: setSelected } : undefined} />
        {list.isPending && !list.data ? <p className="py-2 text-[13px] text-muted-foreground">Loading…</p> : null}
        {list.isSuccess && rows.length === 0 ? (
          <p className="py-2 text-[13px] text-muted-foreground">{presentToday ? "No student matching these filters is marked Present today." : "No students match these filters."}</p>
        ) : null}
      </section>
    </div>
  );
}

function FilterSelect({ label, all, value, onChange, children }: { label: string; all: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select className={cn(selectClass, "w-full")} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{all}</option>
      {children}
    </select>
  );
}

/** Students, average and the three band cards (toggle filters). Always for everyone in the term. */
function SummaryCards({ data, band, onBand }: { data?: { students: number; average_pct: number | null; bands: Record<string, number> }; band: BandKey | null; onBand: (b: BandKey) => void }) {
  const withData = data ? data.students - (data.bands.none ?? 0) : 0;
  const card = "flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div className={card}>
        <span className="text-[13px] font-semibold text-sidebar-foreground">Students</span>
        <span className="text-2xl font-semibold tabular">{data ? data.students : "…"}</span>
        {data && data.bands.none > 0 ? <span className="text-xs text-muted-foreground">{data.bands.none} with no marks yet</span> : null}
      </div>
      <div className={card}>
        <span className="text-[13px] font-semibold text-sidebar-foreground">Average attendance</span>
        <span className="text-2xl font-semibold text-primary tabular">{data ? pctText(data.average_pct) : "…"}</span>
      </div>
      {BAND_ORDER.map((b) => {
        const count = data?.bands[b] ?? 0;
        const share = withData ? Math.round((count * 100) / withData) : 0;
        const on = band === b;
        return (
          <button
            key={b}
            type="button"
            aria-pressed={on}
            onClick={() => onBand(b)}
            className={cn(card, "transition-colors hover:border-primary/50", on && "border-primary ring-2 ring-primary/30", b === "75_plus" && "col-span-2 lg:col-span-1")}
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-sidebar-foreground">
              <span className={cn("size-2.5 rounded-full", BAND_INFO[b].dot)} aria-hidden="true" />
              {BAND_INFO[b].label}
            </span>
            <span className="flex items-baseline gap-2 text-2xl font-semibold tabular">
              {data ? `${share}%` : "…"}
              <span className="text-[13px] font-normal text-muted-foreground">
                {count} student{count === 1 ? "" : "s"}
              </span>
            </span>
            <span className="text-xs text-primary">{on ? "Showing these · click to undo" : "Click to list students"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Attendance({ s }: { s: AdminStudent }) {
  if (s.summary.pct === null) return <span className="text-xs text-muted-foreground">No marks yet</span>;
  return <PctBadge pct={s.summary.pct} band={s.band} />;
}

type Selection = { selected: Set<string>; onChange: (next: Set<string>) => void };

/** Owner only: deletes the ticked students and all their marks after typing "DELETE <count>" (the service checks it again). */
function BulkDeleteBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [confirm, setConfirm] = useState("");
  const phrase = `DELETE ${ids.length}`;
  const del = useMutation({
    mutationFn: () => attendanceApi.deleteStudents(ids, confirm),
    onSuccess: () => {
      void refreshAttendance(qc);
      setConfirming(false);
      setConfirm("");
      onClear();
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {ids.length} student{ids.length === 1 ? "" : "s"} selected
        </span>
        <Button variant="outline" size="sm" onClick={onClear} disabled={del.isPending}>
          Clear selection
        </Button>
        {!confirming ? (
          <Button size="sm" className={DANGER_BUTTON} onClick={() => setConfirming(true)}>
            Delete selected…
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <>
          <p>
            Deletes these students and <b>all of their attendance marks</b> permanently. This cannot be undone (only a database backup brings it back). Type{" "}
            <b className="font-mono">{phrase}</b> to confirm.
          </p>
          <p className="max-h-20 overflow-y-auto font-mono text-xs">{ids.join(", ")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <input className={cn(inputClass, "w-48 font-mono uppercase")} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={`Type ${phrase} to confirm`} placeholder={phrase} />
            <Button className={DANGER_BUTTON} disabled={confirm.trim().toUpperCase() !== phrase || del.isPending} onClick={() => del.mutate()}>
              {del.isPending ? "Deleting…" : `Delete ${ids.length} and their marks`}
            </Button>
            <Button
              variant="outline"
              disabled={del.isPending}
              onClick={() => {
                setConfirming(false);
                setConfirm("");
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : null}
      {del.error ? <p role="alert" className="text-red-700 dark:text-red-400">{del.error.message}</p> : null}
    </div>
  );
}

/** The table on desktop, one card per student on phones. Working days = present + absent. */
function StudentRows({ rows, term, selection }: { rows: AdminStudent[]; term: string; selection?: Selection }) {
  const link = "hover:text-primary hover:underline";
  const allShown = rows.length > 0 && !!selection && rows.every((s) => selection.selected.has(s.niat_id));
  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };
  const toggleAllShown = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const s of rows) {
      if (allShown) next.delete(s.niat_id);
      else next.add(s.niat_id);
    }
    selection.onChange(next);
  };
  const box = "size-4 accent-red-700";
  const th = "px-3 py-2.5 font-semibold";
  const num = "px-3 text-right tabular";
  if (rows.length === 0) return null;
  return (
    <>
      {selection ? (
        <label className="flex items-center gap-2 text-[13px] sm:hidden">
          <input type="checkbox" className={box} checked={allShown} onChange={toggleAllShown} />
          Select all {rows.length} shown
        </label>
      ) : null}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Students and their attendance</caption>
          <thead className="bg-surface-subtle text-left text-xs text-muted-foreground">
            <tr>
              {selection ? (
                <th scope="col" className="w-8 px-3 py-2.5">
                  <input type="checkbox" className={box} checked={allShown} onChange={toggleAllShown} aria-label={`Select all ${rows.length} shown`} />
                </th>
              ) : null}
              <th scope="col" className={th}>NIAT ID</th>
              <th scope="col" className={th}>Name</th>
              <th scope="col" className={th}>Degree</th>
              <th scope="col" className={th}>Section</th>
              <th scope="col" className={th}>Hall</th>
              <th scope="col" className={cn(th, "text-right")}>Days present</th>
              <th scope="col" className={cn(th, "text-right")}>Days absent</th>
              <th scope="col" className={cn(th, "text-right")}>Working days</th>
              <th scope="col" className={cn(th, "text-right")}>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.niat_id} className="border-t border-border hover:bg-muted/60">
                {selection ? (
                  <td className="px-3">
                    <input type="checkbox" className={box} checked={selection.selected.has(s.niat_id)} onChange={() => toggle(s.niat_id)} aria-label={`Select ${s.name}`} />
                  </td>
                ) : null}
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={studentHref(s.niat_id, term)} className={link}>
                    {s.niat_id}
                  </Link>
                </td>
                <td className="px-3 font-semibold">
                  <Link href={studentHref(s.niat_id, term)} className={link}>
                    {s.name}
                  </Link>
                  {s.demo ? <DemoPill /> : null}
                  {s.status !== "active" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(dropped)</span> : null}
                </td>
                <td className="px-3">{s.degree}</td>
                <td className="px-3">{s.section}</td>
                <td className="px-3">{hallLabel(s.hall_no)}</td>
                <td className={num}>{s.summary.days_attended}</td>
                <td className={num}>{s.summary.days_absent}</td>
                <td className={num}>{s.summary.marked_days}</td>
                <td className="px-3 text-right">
                  <Attendance s={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 sm:hidden">
        {rows.map((s) => (
          <li key={s.niat_id} className="flex items-start gap-2">
            {selection ? (
              <input type="checkbox" className={cn(box, "mt-3.5 shrink-0")} checked={selection.selected.has(s.niat_id)} onChange={() => toggle(s.niat_id)} aria-label={`Select ${s.name}`} />
            ) : null}
            <Link href={studentHref(s.niat_id, term)} className="block min-w-0 flex-1 rounded-lg border border-border p-3 hover:bg-muted/60">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {s.name}
                    {s.demo ? <DemoPill /> : null}
                    {s.status !== "active" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(dropped)</span> : null}
                  </div>
                  <div className="font-mono text-xs break-words text-muted-foreground">
                    {s.niat_id} · {s.degree} · {s.section} · {hallLabel(s.hall_no)}
                  </div>
                </div>
                <Attendance s={s} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Present {s.summary.days_attended} · Absent {s.summary.days_absent} · of {s.summary.marked_days} days
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
