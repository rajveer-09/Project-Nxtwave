/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/common/components/empty-state";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { ApiError } from "@/common/lib/api-client";
import { attendanceApi } from "@/modules/attendance/api";
import { saveAttendanceAction } from "@/modules/attendance/actions";
import type { Mark, SheetRow } from "@/modules/attendance/types";
import { formatDate } from "@/common/lib/dates";
import { cn } from "@/common/lib/utils";

const control =
  "h-10 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Hall attendance sheet (ported from the attendance dashboard's MarkAttendance).
 * Keyboard: ↑/↓ move between students, P / A mark and move down, Delete clears.
 * Only changed rows are sent; all of them are saved or none.
 * savesInHub: NxtOne saves the marks to the database itself (saveAttendanceAction); otherwise they go
 * to the attendance service (or the development sample).
 * mine: an instructor's own students and their hall. The sheet opens on that hall showing only them;
 * "Everyone in this hall" shows (and lets them mark) the rest.
 */
export function HallSheet({
  canMark,
  savesInHub = false,
  today,
  mine,
}: {
  canMark: boolean;
  savesInHub?: boolean;
  today: string;
  mine?: { ids: string[]; hall: string | null };
}) {
  const queryClient = useQueryClient();
  const myIds = new Set(mine?.ids ?? []);
  const [onlyMine, setOnlyMine] = useState(!!mine && mine.ids.length > 0);
  // null until a hall is picked; "" is the students with no hall.
  const [hall, setHall] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, Mark>>({});
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const halls = useQuery({ queryKey: ["attendance", "halls"], queryFn: attendanceApi.halls });
  const myHall = mine?.hall !== null && mine?.hall !== undefined && halls.data?.halls.some((h) => h.hall === mine.hall) ? mine.hall : undefined;
  const selectedHall = hall ?? myHall ?? halls.data?.halls[0]?.hall ?? null;
  const hallName = selectedHall === null ? "…" : selectedHall || "No hall";
  const sheet = useQuery({
    queryKey: ["attendance", "sheet", date, selectedHall],
    queryFn: () => attendanceApi.sheet(date, selectedHall ?? ""),
    enabled: selectedHall !== null,
  });

  // The students in view: an instructor's own (by default) or everyone in the hall.
  const all = sheet.data?.students ?? [];
  const minesHere = all.filter((r) => myIds.has(r.niat_id)).length;
  const base = onlyMine ? all.filter((r) => myIds.has(r.niat_id)) : all;
  const rows = base.filter(
    (r) => !search.trim() || r.name.toLowerCase().includes(search.trim().toLowerCase()) || r.niat_id.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const current = (r: SheetRow): Mark => (r.niat_id in edits ? edits[r.niat_id] : r.status);
  const changed = (sheet.data?.students ?? []).filter((r) => r.niat_id in edits && edits[r.niat_id] !== r.status);
  const dirty = changed.length > 0;
  const counted = base.filter((r) => r.counted);
  const present = counted.filter((r) => current(r) === "P").length;
  const absent = counted.filter((r) => current(r) === "A").length;

  // Warn before leaving with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => {
      const marks = changed.map((r) => ({ niat_id: r.niat_id, date, status: edits[r.niat_id] }));
      if (!savesInHub) return attendanceApi.saveMarks(marks);
      const result = await saveAttendanceAction(marks);
      if (!result.ok) throw new Error(result.details?.length ? `${result.error} ${result.details[0].niat_id}: ${result.details[0].message}` : result.error);
      return { saved: result.saved, cleared: result.cleared };
    },
    onSuccess: async (result) => {
      toast.success(`Saved ${result.saved} mark${result.saved === 1 ? "" : "s"}${result.cleared ? `, cleared ${result.cleared}` : ""} for ${hallName} on ${formatDate(date)}.`);
      setEdits({});
      await queryClient.invalidateQueries({ queryKey: ["attendance", "sheet", date, selectedHall] });
    },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Couldn't save. Your marks are still here; try again."),
  });

  function switchTo(next: { hall?: string; date?: string }) {
    if (dirty && !window.confirm("You have unsaved marks. Discard them?")) return;
    setEdits({});
    setActive(0);
    if (next.hall !== undefined) setHall(next.hall);
    if (next.date !== undefined) setDate(next.date);
  }

  function setMark(row: SheetRow, mark: Mark) {
    if (!canMark || !row.counted) return;
    setEdits((prev) => ({ ...prev, [row.niat_id]: mark }));
  }

  function focusRow(index: number) {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setActive(clamped);
    rowRefs.current[clamped]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTableSectionElement>) {
    const row = rows[active];
    if (!row) return;
    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "j") {
      event.preventDefault();
      focusRow(active + 1);
    } else if (key === "arrowup" || key === "k") {
      event.preventDefault();
      focusRow(active - 1);
    } else if (key === "p" || key === "a") {
      event.preventDefault();
      setMark(row, key === "p" ? "P" : "A");
      focusRow(active + 1);
    } else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      setMark(row, null);
    }
  }

  const allNotCounted = !!sheet.data && sheet.data.students.length > 0 && counted.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Hall
            <select value={selectedHall ?? ""} onChange={(e) => switchTo({ hall: e.target.value })} className={cn(control, "min-w-36")} disabled={halls.isLoading}>
              {(halls.data?.halls ?? []).map((h) => (
                <option key={h.hall} value={h.hall}>
                  {h.hall || "No hall"} · {h.students}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Date
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && switchTo({ date: e.target.value })} className={control} />
          </label>
          {mine ? (
            <div role="group" aria-label="Students shown" className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Show
              <span className="inline-flex h-10 items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {[
                  [true, `My students${selectedHall !== null ? ` · ${minesHere}` : ""}`],
                  [false, "Everyone in this hall"],
                ].map(([value, text]) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={onlyMine === value}
                    onClick={() => {
                      setOnlyMine(value as boolean);
                      setActive(0);
                    }}
                    className={cn(
                      "h-9 rounded-md px-3 text-[13px] font-semibold",
                      onlyMine === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {text as string}
                  </button>
                ))}
              </span>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Find in hall
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or NIAT ID" className={cn(control, "w-48")} />
          </label>
        </div>
        <dl className="grid grid-cols-3 gap-2.5">
          {[
            ["Present", present, "text-accent-strong"],
            ["Absent", absent, "text-warning"],
            ["Not marked", counted.length - present - absent, "text-foreground"],
          ].map(([labelText, value, tone]) => (
            <div key={labelText as string} className="min-w-24 rounded-xl border border-border bg-card px-3.5 py-2">
              <dt className="text-xs font-semibold text-muted-foreground">{labelText}</dt>
              <dd className={cn("font-heading text-2xl font-semibold tabular", tone as string)}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {!canMark ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
          Read only: you can see the hall&apos;s marks here. Instructors and admins mark attendance.
        </p>
      ) : null}
      {onlyMine && sheet.data && minesHere === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
          None of your students are in {hallName}. Switch to &quot;Everyone in this hall&quot; to mark this hall
          {myHall !== undefined && myHall !== selectedHall ? `, or pick ${myHall || "No hall"}` : ""}.
        </p>
      ) : null}

      <section aria-label={`${hallName} attendance sheet`} className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">
            {hallName} · {formatDate(date)} · {onlyMine ? `${base.length} of your students` : `${all.length} students`}
          </span>
          {canMark ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-xs text-muted-foreground md:inline">Keys: ↑ ↓ move · P / A mark · Delete clear</span>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={!counted.some((r) => current(r) === null)}
                onClick={() => setEdits((prev) => ({ ...prev, ...Object.fromEntries(counted.filter((r) => current(r) === null).map((r) => [r.niat_id, "P"])) }))}
              >
                Mark the rest present
              </Button>
              <Button type="button" className="h-10 px-4" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : dirty ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}
              </Button>
            </div>
          ) : null}
        </div>

        {sheet.isLoading || halls.isLoading ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : sheet.isError || halls.isError ? (
          <div className="p-4">
            <EmptyState title="Couldn't load the sheet" description={(sheet.error ?? halls.error)?.message} />
          </div>
        ) : allNotCounted ? (
          <div className="p-4">
            <EmptyState icon={CalendarOff} title={`${formatDate(date)} doesn't count for attendance`} description={sheet.data?.students[0]?.reason} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <caption className="sr-only">Attendance for {hallName}. Use the arrow keys to move between students and P or A to mark.</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  <th scope="col" className="border-b border-border py-2.5 pr-3 pl-4">Student</th>
                  <th scope="col" className="border-b border-border px-3 py-2.5">College · Section</th>
                  <th scope="col" className="border-b border-border px-3 py-2.5">Note</th>
                  <th scope="col" className="border-b border-border py-2.5 pr-4 pl-3">Mark</th>
                </tr>
              </thead>
              <tbody onKeyDown={onKeyDown}>
                {rows.map((row, i) => {
                  const mark = current(row);
                  const edited = row.niat_id in edits && edits[row.niat_id] !== row.status;
                  return (
                    <tr
                      key={row.niat_id}
                      ref={(el) => {
                        rowRefs.current[i] = el;
                      }}
                      tabIndex={i === active ? 0 : -1}
                      onFocus={() => setActive(i)}
                      aria-label={`${row.name}, ${mark === "P" ? "present" : mark === "A" ? "absent" : "not marked"}${row.counted ? "" : `, can't be marked: ${row.reason}`}`}
                      className={cn("outline-none focus-visible:bg-accent", edited && "bg-[#FFFBF5] dark:bg-[#1F1A14]", !row.counted && "text-muted-foreground")}
                    >
                      <td className="border-b border-muted py-2 pr-3 pl-4">
                        <span className="font-semibold text-foreground">{row.name}</span>
                        <div className="text-xs text-muted-foreground tabular">{row.niat_id}</div>
                      </td>
                      <td className="border-b border-muted px-3 py-2 text-sidebar-foreground">
                        {row.degree} · {row.section}
                      </td>
                      <td className="border-b border-muted px-3 py-2 text-xs">
                        {!row.counted ? row.reason : edited ? <span className="font-semibold text-warning">Unsaved</span> : null}
                      </td>
                      <td className="border-b border-muted py-1.5 pr-4 pl-3">
                        <div role="group" aria-label={`Mark ${row.name}`} className="inline-flex overflow-hidden rounded-lg border border-input">
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-pressed={mark === "P"}
                            disabled={!canMark || !row.counted}
                            onClick={() => setMark(row, mark === "P" ? null : "P")}
                            className={cn("min-h-10 min-w-12 font-bold disabled:cursor-not-allowed", mark === "P" ? "bg-primary text-primary-foreground" : "bg-card text-sidebar-foreground hover:bg-muted")}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-pressed={mark === "A"}
                            disabled={!canMark || !row.counted}
                            onClick={() => setMark(row, mark === "A" ? null : "A")}
                            className={cn("min-h-10 min-w-12 border-l border-input font-bold disabled:cursor-not-allowed", mark === "A" ? "bg-[#C2560F] text-white" : "bg-card text-sidebar-foreground hover:bg-muted")}
                          >
                            A
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
