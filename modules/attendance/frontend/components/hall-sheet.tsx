/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarOff, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/common/components/empty-state";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { ApiError } from "@/common/lib/api-client";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { saveAttendanceAction } from "@nxtone/attendance-ui/actions";
import type { Mark, SheetRow } from "@nxtone/attendance-ui/types";
import { formatDate } from "@/common/lib/dates";
import { searchMatcher } from "@/common/lib/search";
import { cn } from "@/common/lib/utils";

const control =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** The three choices on every row, in the attendance dashboard's order. */
const CHOICES: { value: Mark; label: string; on: string }[] = [
  { value: "P", label: "Present", on: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" },
  { value: "A", label: "Absent", on: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950" },
  { value: null, label: "Not marked", on: "bg-slate-600 text-white dark:bg-slate-500 dark:text-slate-950" },
];

const CHIP: Record<"P" | "A" | "none", string> = {
  P: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  A: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
  none: "border-border bg-muted text-muted-foreground",
};

function MarkChip({ mark }: { mark: Mark }) {
  return (
    <span className={cn("inline-flex h-6 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-bold", CHIP[mark ?? "none"])}>
      {mark ?? "–"}
    </span>
  );
}

function Legend({ present, absent, unmarked }: { present: number; absent: number; unmarked: number }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <MarkChip mark="P" /> Present <b className="font-semibold text-foreground tabular">{present}</b>
      </span>
      <span className="flex items-center gap-1.5">
        <MarkChip mark="A" /> Absent <b className="font-semibold text-foreground tabular">{absent}</b>
      </span>
      <span className="flex items-center gap-1.5">
        <MarkChip mark={null} /> Not marked <b className="font-semibold text-foreground tabular">{unmarked}</b>
      </span>
    </p>
  );
}

const hallLabel = (hall: string) => hall || "No hall";

/**
 * Hall attendance sheet (the attendance dashboard's MarkAttendance, in the Student Hub theme).
 * Pick a hall, pick a date, mark each student Present / Absent / Not marked, then save.
 * Only changed rows are sent; all of them are saved or none.
 * Keyboard: ↑/↓ (or J/K) move between students, P / A mark and move down, Delete clears.
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
  // undefined until a hall is picked; "" is the students with no hall.
  const [hall, setHall] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, Mark>>({});
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const halls = useQuery({ queryKey: ["attendance", "halls"], queryFn: attendanceApi.halls });
  // Instructors open on their own hall; everyone else picks one.
  const myHall = mine?.hall !== null && mine?.hall !== undefined && halls.data?.halls.some((h) => h.hall === mine.hall) ? mine.hall : undefined;
  const selectedHall = hall ?? myHall;
  const hallName = selectedHall === undefined ? "" : hallLabel(selectedHall);
  const sheet = useQuery({
    queryKey: ["attendance", "sheet", date, selectedHall],
    queryFn: () => attendanceApi.sheet(date, selectedHall ?? ""),
    enabled: selectedHall !== undefined,
  });

  // The students in view: an instructor's own (by default) or everyone in the hall.
  const all = sheet.data?.students ?? [];
  const minesHere = all.filter((r) => myIds.has(r.niat_id)).length;
  const base = onlyMine ? all.filter((r) => myIds.has(r.niat_id)) : all;
  const match = searchMatcher(search);
  const term = search.trim();
  // Search only narrows the list; edits to students not shown are kept and saved.
  const rows = base.filter((r) => match(r.name, r.niat_id));
  const markable = rows.filter((r) => r.counted);
  const current = (r: SheetRow): Mark => (r.niat_id in edits ? edits[r.niat_id] : r.status);
  const changed = all.filter((r) => r.niat_id in edits && edits[r.niat_id] !== r.status);
  const dirty = changed.length > 0;
  const counted = base.filter((r) => r.counted);
  const present = counted.filter((r) => current(r) === "P").length;
  const absent = counted.filter((r) => current(r) === "A").length;
  const allNotCounted = all.length > 0 && all.every((r) => !r.counted);

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
    if (next.hall !== undefined && next.hall === selectedHall) return;
    if (dirty && !window.confirm("You have unsaved marks. Discard them?")) return;
    setEdits({});
    setActive(0);
    if (next.hall !== undefined) {
      setHall(next.hall);
      setSearch("");
    }
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

  function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
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

  return (
    <SectionCard title="Mark attendance" description="Pick a hall, then mark each student Present or Absent for the day." bodyClassName="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Hall">
        {halls.isLoading
          ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-10 w-24 rounded-lg" />)
          : (halls.data?.halls ?? []).map((h) => {
              const on = selectedHall === h.hall;
              return (
                <button
                  key={h.hall || "__none"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => switchTo({ hall: h.hall })}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-card text-foreground hover:border-accent-border hover:bg-accent",
                  )}
                >
                  {hallLabel(h.hall)}
                  <span className={cn("text-xs font-medium tabular", on ? "text-primary-foreground/75" : "text-muted-foreground")}>{h.students}</span>
                </button>
              );
            })}
        {halls.isSuccess && halls.data.halls.length === 0 ? <p className="text-sm text-muted-foreground">No active students yet.</p> : null}
      </div>
      {halls.isError ? <EmptyState title="Couldn't load the halls" description={halls.error.message} /> : null}

      {selectedHall === undefined ? (
        halls.isError ? null : (
          <p className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-8 text-center text-sm text-muted-foreground">
            Pick a hall above to list its students.
          </p>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Date
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && switchTo({ date: e.target.value })} className={control} />
            </label>
            {mine ? (
              <span role="group" aria-label="Students shown" className="inline-flex h-10 items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {[
                  [true, `My students · ${minesHere}`],
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
            ) : null}
            {canMark ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={!markable.length}
                  onClick={() => setEdits((prev) => ({ ...prev, ...Object.fromEntries(markable.map((r) => [r.niat_id, "P" as Mark])) }))}
                >
                  {term ? `Mark ${markable.length} shown present` : "Mark all present"}
                </Button>
                <Button type="button" variant="outline" className="h-10" disabled={!dirty} onClick={() => setEdits({})}>
                  Undo changes
                </Button>
                <Button type="button" className="h-10 px-5 sm:ml-auto" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : dirty ? `Save (${changed.length})` : "Save"}
                </Button>
              </>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActive(0);
              }}
              placeholder={`Search ${hallName} by name or NIAT ID`}
              aria-label={`Search students in ${hallName}`}
              className={cn(control, "w-full pl-9")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {hallName}: {term ? `${rows.length} of ${base.length}` : base.length} student{base.length === 1 ? "" : "s"}
              {onlyMine ? " of yours" : ""}
              {term ? " match the search" : ""}. Names open in a new tab, so unsaved marks stay here.
              {canMark ? <span className="hidden md:inline"> Keys: ↑ ↓ move · P / A mark · Delete clears.</span> : null}
            </p>
            <Legend present={present} absent={absent} unmarked={counted.length - present - absent} />
          </div>

          {!canMark ? (
            <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-[13px] text-sidebar-foreground">
              Read only: you can see the hall&apos;s marks here. Instructors and admins mark attendance.
            </p>
          ) : null}
          {onlyMine && sheet.data && minesHere === 0 ? (
            <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-[13px] text-sidebar-foreground">
              None of your students are in {hallName}. Switch to &quot;Everyone in this hall&quot; to mark this hall
              {myHall !== undefined && myHall !== selectedHall ? `, or pick ${hallLabel(myHall)}` : ""}.
            </p>
          ) : null}

          {sheet.isLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : sheet.isError ? (
            <EmptyState title="Couldn't load the sheet" description={sheet.error.message} />
          ) : allNotCounted ? (
            <EmptyState icon={CalendarOff} title={`${formatDate(date)} doesn't count for attendance`} description={all[0]?.reason} />
          ) : (
            <>
              <ul
                aria-label={`DSA attendance for ${hallName}. Use the arrow keys to move between students and P or A to mark.`}
                onKeyDown={onKeyDown}
                className="divide-y divide-border overflow-hidden rounded-xl border border-border"
              >
                {rows.map((row, i) => {
                  const mark = current(row);
                  const edited = row.niat_id in edits && edits[row.niat_id] !== row.status;
                  return (
                    <li
                      key={row.niat_id}
                      ref={(el) => {
                        rowRefs.current[i] = el;
                      }}
                      tabIndex={i === active ? 0 : -1}
                      onFocus={() => setActive(i)}
                      aria-label={`${row.name}, ${mark === "P" ? "present" : mark === "A" ? "absent" : "not marked"}${row.counted ? "" : `, can't be marked: ${row.reason}`}`}
                      className={cn(
                        "flex flex-col gap-2 px-4 py-3 outline-none transition-colors focus-visible:bg-accent sm:flex-row sm:items-center",
                        edited ? "bg-warning-soft/60" : "hover:bg-surface-subtle",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/students/${row.niat_id}`} target="_blank" tabIndex={-1} className="truncate text-[15px] font-semibold text-foreground hover:text-primary hover:underline">
                            {row.name}
                          </Link>
                          {edited ? <span className="rounded-full border border-warning-border px-2 py-px text-[11px] font-semibold text-warning">Unsaved</span> : null}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.niat_id} · {row.degree} · {row.section}
                        </div>
                      </div>
                      {row.counted ? (
                        <div role="group" aria-label={`DSA attendance for ${row.name}`} className="inline-flex self-start overflow-hidden rounded-lg border border-input sm:self-auto">
                          {CHOICES.map((c) => {
                            const on = mark === c.value;
                            return (
                              <button
                                key={c.label}
                                type="button"
                                tabIndex={-1}
                                aria-pressed={on}
                                disabled={!canMark}
                                onClick={() => setMark(row, c.value)}
                                className={cn(
                                  "min-h-10 border-l border-input px-4 text-[13px] font-semibold transition-colors first:border-l-0 disabled:cursor-not-allowed",
                                  on ? c.on : "bg-card text-sidebar-foreground hover:bg-muted disabled:hover:bg-card",
                                )}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{row.reason}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {term && rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No student in {hallName} matches “{search.trim()}”.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}
