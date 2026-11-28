/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/common/components/empty-state";
import { SectionCard } from "@/common/components/section-card";
import { Button } from "@/common/ui/button";
import { Skeleton } from "@/common/ui/skeleton";
import { ApiError } from "@/common/lib/api-client";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { saveAttendanceAction } from "@nxtone/attendance-ui/actions";
import type { Mark, SheetRow } from "@nxtone/attendance-ui/types";
import { searchMatcher } from "@/common/lib/search";
import { cn } from "@/common/lib/utils";

const control =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** The two choices on every row. A saved mark can be switched between them, not cleared, here. */
const CHOICES: { value: "P" | "A"; label: string; on: string }[] = [
  { value: "P", label: "Present", on: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" },
  { value: "A", label: "Absent", on: "bg-red-600 text-white dark:bg-red-500 dark:text-red-950" },
];

const CHIP: Record<"P" | "A" | "none", string> = {
  P: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  A: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
  none: "border-border bg-muted text-muted-foreground",
};

const NOTICE = {
  ok: "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  error: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  amber: "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
};

function MarkChip({ mark }: { mark: Mark }) {
  return (
    <span className={cn("inline-flex h-6 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-bold", CHIP[mark ?? "none"])}>
      {mark ?? "–"}
    </span>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <MarkChip mark="P" /> P – Present
      </span>
      <span className="flex items-center gap-1.5">
        <MarkChip mark="A" /> A – Absent
      </span>
      <span className="flex items-center gap-1.5">
        <MarkChip mark={null} /> – Not marked
      </span>
    </p>
  );
}

const hallLabel = (hall: string) => hall || "No hall";

/** "Fri 28 Nov" */
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDay = (ymd: string) => dayFmt.format(new Date(`${ymd}T00:00:00Z`));
/** "10:42 am", in IST. */
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const fmtTime = (iso: string) => (iso ? timeFmt.format(new Date(iso)).toLowerCase() : "");
const saverLabel = (name: string) => name || "an unknown admin";

/** Tabs go by the saved mark, so a row stays in view while it is changed, until it is saved. */
type Tab = "all" | "present" | "absent" | "unmarked";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "unmarked", label: "Not marked" },
];
function inTab(r: SheetRow, tab: Tab) {
  if (tab === "all") return true;
  if (!r.counted) return false;
  return tab === "present" ? r.status === "P" : tab === "absent" ? r.status === "A" : r.status === null;
}

type Notice = { kind: "ok" | "error"; text: string; rows?: string[] } | null;

/** Per-row refusals from a failed save, whichever way it was saved. */
function refusedRows(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.filter((d) => d && typeof d === "object").map((d) => `${(d as { niat_id?: string }).niat_id ?? "?"}: ${(d as { message?: string }).message ?? ""}`);
}

class SaveError extends Error {
  constructor(message: string, readonly rows: string[]) {
    super(message);
  }
}

/**
 * Hall attendance sheet. Pick a hall (kept in the URL as ?hall=), pick a date, mark each student
 * Present or Absent, then save. Only changed rows are sent; all of them are saved or none.
 * Keyboard: ↑/↓ (or J/K) move between students, P / A mark and move down.
 * savesInHub: NxtOne saves the marks to the database itself (saveAttendanceAction); otherwise they go
 * to the attendance service (or the development sample).
 * mine: an instructor's own students and their hall. The sheet opens on that hall showing only them;
 * "Everyone in this hall" shows (and lets them mark) the rest.
 * The Owner also sees who saved each mark (the service sends saved_by to the Owner only).
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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const myIds = new Set(mine?.ids ?? []);
  const [onlyMine, setOnlyMine] = useState(!!mine && mine.ids.length > 0);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [edits, setEdits] = useState<Record<string, "P" | "A">>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [active, setActive] = useState(0);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  const halls = useQuery({ queryKey: ["attendance", "halls"], queryFn: attendanceApi.halls });
  // The hall lives in the URL (?hall=, "" = no hall). Instructors open on their own hall; everyone else picks one.
  const urlHall = params.has("hall") ? (params.get("hall") ?? "") : undefined;
  const myHall = mine?.hall !== null && mine?.hall !== undefined && halls.data?.halls.some((h) => h.hall === mine.hall) ? mine.hall : undefined;
  const selectedHall = urlHall ?? myHall;
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
  // Search and tabs only narrow the list; edits to students not shown are kept and saved.
  const searched = base.filter((r) => match(r.name, r.niat_id));
  const rows = searched.filter((r) => inTab(r, tab));
  const narrowed = term !== "" || tab !== "all";
  const markable = rows.filter((r) => r.counted);
  const current = (r: SheetRow): Mark => edits[r.niat_id] ?? r.status;
  const rest = markable.filter((r) => current(r) === null);
  const changed = all.filter((r) => r.counted && r.niat_id in edits && edits[r.niat_id] !== r.status);
  const dirty = changed.length > 0;
  // Whole day not markable: decided on every row of the hall, never on a filtered view.
  const allNotCounted = all.length > 0 && all.every((r) => !r.counted);

  // Owner only: who saved the hall's marks, latest first (the whole hall, ignoring search and tabs).
  const savers = (() => {
    const by = new Map<string, { marks: number; last: string }>();
    for (const r of all) {
      if (!r.saved_by || r.status === null) continue;
      const cur = by.get(r.saved_by.name) ?? { marks: 0, last: "" };
      by.set(r.saved_by.name, { marks: cur.marks + 1, last: r.saved_by.at > cur.last ? r.saved_by.at : cur.last });
    }
    return [...by.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last));
  })();

  // Warn before leaving with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => {
      // Only rows that changed: re-sending unchanged rows would overwrite who saved them.
      const marks = changed.map((r) => ({ niat_id: r.niat_id, date, status: edits[r.niat_id] }));
      if (!savesInHub) {
        try {
          return await attendanceApi.saveMarks(marks);
        } catch (error) {
          if (error instanceof ApiError) throw new SaveError(error.message, refusedRows(error.details));
          throw error;
        }
      }
      const result = await saveAttendanceAction(marks);
      if (!result.ok) throw new SaveError(result.error, refusedRows(result.details));
      return { saved: result.saved, cleared: result.cleared };
    },
    onSuccess: async (result) => {
      const n = result.saved + result.cleared;
      setNotice({ kind: "ok", text: `Saved attendance for ${n} student${n === 1 ? "" : "s"} in ${hallName} on ${fmtDay(date)}.` });
      setEdits({});
      // Every view that shows marks: sheets, halls, student lists, profiles and months, internships.
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (error) =>
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Couldn't save. Your marks are still here; try again.",
        rows: error instanceof SaveError ? error.rows : [],
      }),
  });

  function setHallInUrl(hall: string) {
    const next = new URLSearchParams(params.toString());
    next.set("hall", hall);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  function switchTo(next: { hall?: string; date?: string }) {
    if (next.hall !== undefined && next.hall === selectedHall) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setEdits({});
    setNotice(null);
    setActive(0);
    if (next.hall !== undefined) {
      setHallInUrl(next.hall);
      setSearch("");
    }
    if (next.date !== undefined) setDate(next.date);
  }

  function setMark(row: SheetRow, mark: "P" | "A") {
    if (!canMark || !row.counted) return;
    setEdits((prev) => ({ ...prev, [row.niat_id]: mark }));
  }

  function markEach(list: SheetRow[], mark: "P" | "A") {
    setEdits((prev) => ({ ...prev, ...Object.fromEntries(list.map((r) => [r.niat_id, mark])) }));
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
    }
  }

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? "";

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
                <Button type="button" variant="outline" className="h-10" disabled={!markable.length} onClick={() => markEach(markable, "P")}>
                  {narrowed ? `Mark ${markable.length} shown present` : "Mark all present"}
                </Button>
                <Button type="button" variant="outline" className="h-10" disabled={!markable.length} onClick={() => markEach(markable, "A")}>
                  {narrowed ? `Mark ${markable.length} shown absent` : "Mark all absent"}
                </Button>
                <Button type="button" variant="outline" className="h-10" disabled={!rest.length} onClick={() => markEach(rest, "A")}>
                  {rest.length ? `Mark rest absent (${rest.length})` : "Mark rest absent"}
                </Button>
                <Button type="button" variant="outline" className="h-10" disabled={!dirty} onClick={() => setEdits({})}>
                  Undo changes
                </Button>
                <Button type="button" className="h-10 px-5 sm:ml-auto" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                  {save.isPending ? "Saving…" : `Save (${changed.length})`}
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

          <div role="tablist" aria-label="Show students by saved mark" className="flex flex-wrap gap-1 border-b border-border">
            {TABS.map((t) => {
              const on = tab === t.key;
              const count = searched.filter((r) => inTab(r, t.key)).length;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setTab(t.key);
                    setActive(0);
                  }}
                  className={cn(
                    "-mb-px flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold",
                    on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 py-px text-[11px] tabular", on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {hallName}: {narrowed ? `${rows.length} of ${base.length} students shown` : `${base.length} student${base.length === 1 ? "" : "s"}`}
              {onlyMine ? " of yours" : ""}. Tabs go by the saved mark, so a student stays in view while you change them until you save. Names open in a new tab, so
              unsaved marks stay here.
              {canMark ? <span className="hidden md:inline"> Keys: ↑ ↓ move · P / A mark.</span> : null}
            </p>
            <Legend />
            {savers.length ? (
              <p className="text-xs text-muted-foreground">
                Saved by (for {fmtDay(date)}, all of {hallName}):{" "}
                {savers.map(([name, s], i) => (
                  <span key={name || "__unknown"}>
                    {i ? " · " : ""}
                    <span className="font-semibold text-foreground">{saverLabel(name)}</span> – {s.marks} mark{s.marks === 1 ? "" : "s"}, last at {fmtTime(s.last)}
                  </span>
                ))}
              </p>
            ) : null}
          </div>

          {notice ? (
            <div role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "ok" ? NOTICE.ok : NOTICE.error}>
              <p>{notice.text}</p>
              {notice.rows?.length ? (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {notice.rows.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

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
          {allNotCounted ? <p className={NOTICE.amber}>{all[0]?.reason} Attendance cannot be marked for this date.</p> : null}

          {sheet.isLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : sheet.isError ? (
            <EmptyState title="Couldn't load the sheet" description={sheet.error.message} />
          ) : (
            <>
              {rows.length ? (
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
                          <div className="flex flex-col items-start gap-1 sm:items-end">
                            <div className="flex items-center gap-2">
                              {mark === null ? <span className={cn("inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold", CHIP.none)}>Not marked</span> : null}
                              <div role="group" aria-label={`DSA attendance for ${row.name}`} className="inline-flex overflow-hidden rounded-lg border border-input">
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
                            </div>
                            {row.saved_by && row.status !== null ? (
                              <span className="text-[11px] text-muted-foreground">
                                Saved by {saverLabel(row.saved_by.name)}, {fmtTime(row.saved_by.at)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">{row.reason}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {!rows.length && sheet.isSuccess && (narrowed || base.length === 0) && !(onlyMine && minesHere === 0) ? (
                <p className="text-sm text-muted-foreground">
                  No student in {hallName}
                  {tab !== "all" ? ` is saved as ${tabLabel}` : ""}
                  {term ? ` matching “${term}”` : ""}.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}
