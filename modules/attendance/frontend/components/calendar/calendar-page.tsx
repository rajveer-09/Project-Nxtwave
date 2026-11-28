/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/common/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/common/ui/popover";
import { cn } from "@/common/lib/utils";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { DeleteEntriesDialog, DeletionLogCard } from "@nxtone/attendance-ui/components/calendar/actions";
import { CalendarEntriesCard, ImportHistoryCard } from "@nxtone/attendance-ui/components/calendar/entries";
import { Banner, fieldClass, KIND_INFO, kindLabel, scopeLabel, type Msg } from "@nxtone/attendance-ui/components/calendar/shared";
import { CATEGORY_INFO, fmtDate, fmtMonth, PERIOD_STATE_LABEL } from "@nxtone/attendance-ui/components/students/ui";
import type { CalendarDay, DayType, EntryKey, InternshipListItem } from "@nxtone/attendance-ui/types";

/*
 * DSA attendance › Calendar. Everyone sees the month view (how each degree's students see a day).
 * Owners and admins also edit days and get Manage entries, Import history and the Deletion log;
 * resetting imported entries is the Owner's. The service enforces all of it again.
 */

type Tab = "month" | "entries" | "history" | "log";
const TABS: { id: Tab; label: string }[] = [
  { id: "month", label: "Month view" },
  { id: "entries", label: "Manage entries" },
  { id: "history", label: "Import history" },
  { id: "log", label: "Deletion log" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const viewLabel = (v: string) => (v === "ALL" ? "All degrees" : v);

function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CalendarPage({ canEdit, isOwner }: { canEdit: boolean; isOwner: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get("tab");
  // The other tabs are for Owners and admins only.
  const tab: Tab = canEdit && (asked === "entries" || asked === "history" || asked === "log") ? asked : "month";
  const go = (t: Tab, extra: Record<string, string> = {}) =>
    router.replace(t === "month" ? pathname : `${pathname}?${new URLSearchParams({ tab: t, ...extra })}`, { scroll: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Calendar</h2>
        <p className="text-[13px] text-muted-foreground">
          Mon–Sat are working days and Sundays are off unless you add an entry. A degree&rsquo;s own entry wins over an &ldquo;All&rdquo; entry. Days outside every term never
          count.
        </p>
      </div>
      {canEdit ? (
        <div className="inline-flex max-w-full self-start overflow-x-auto rounded-lg bg-muted p-0.5" role="tablist" aria-label="Calendar section">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => go(t.id)}
              className={cn(
                "h-9 rounded-md px-3.5 text-[13px] font-semibold whitespace-nowrap",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      {tab === "month" ? <MonthView canEdit={canEdit} /> : null}
      {tab === "entries" ? <CalendarEntriesCard isOwner={isOwner} batch={params.get("batch") ?? ""} onBatch={(b) => go("entries", b ? { batch: b } : {})} /> : null}
      {tab === "history" ? <ImportHistoryCard isOwner={isOwner} onView={(id) => go("entries", { batch: String(id) })} /> : null}
      {tab === "log" ? <DeletionLogCard isOwner={isOwner} /> : null}
    </div>
  );
}

function MonthView({ canEdit }: { canEdit: boolean }) {
  const [ym, setYm] = useState("");
  const [view, setView] = useState("ALL");
  const month = useQuery({ queryKey: ["attendance", "calendar", ym, view], queryFn: () => attendanceApi.calendar(ym, view), placeholderData: (p) => p });
  const shown = month.data?.month ?? ym;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [picking, setPicking] = useState(false);
  const [prefill, setPrefill] = useState<{ key: number; entry?: CalendarDay["entries"][number] }>({ key: 0 });

  // First click selects one day and fills the editor from it; the second selects the range (either order).
  const pick = (d: CalendarDay) => {
    if (!canEdit) return;
    if (picking && from) {
      const [a, b] = d.date < from ? [d.date, from] : [from, d.date];
      setFrom(a);
      setTo(b);
      setPicking(false);
    } else {
      setFrom(d.date);
      setTo(d.date);
      setPicking(true);
      const own = d.entries.find((e) => e.applies_to === view) ?? d.entries[0];
      setPrefill((p) => ({ key: p.key + 1, entry: own }));
    }
  };

  const days = month.data?.days ?? [];
  const lead = days.length ? days[0].weekday : 0; // Sunday-first grid
  const first = days[0]?.date ?? "";
  const last = days.at(-1)?.date ?? "";
  const interns = useQuery({
    queryKey: ["attendance", "internships", "month", first, last],
    queryFn: () => attendanceApi.internships(first, last),
    enabled: !!first,
    placeholderData: (p) => p,
  });
  const internsOn = (date: string) => (interns.data?.internships ?? []).filter((i) => i.start <= date && date <= i.end);
  const today = month.data?.today;

  return (
    <>
      <div className={cn("grid gap-4", canEdit && "lg:grid-cols-3")}>
        <section aria-label="Month" className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", canEdit && "lg:col-span-2")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setYm(shiftMonth(shown, -1))} disabled={!shown} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <h3 className="min-w-40 text-center text-lg font-semibold" aria-live="polite">
                {shown ? fmtMonth(shown) : "…"}
              </h3>
              <Button variant="outline" size="icon" onClick={() => setYm(shiftMonth(shown, 1))} disabled={!shown} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
            <div className="inline-flex rounded-lg bg-muted p-0.5" role="group" aria-label="View as">
              {(month.data?.applies_to ?? ["ALL", "BITS", "CDU"]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn("h-8 rounded-md px-3 text-xs font-semibold", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {viewLabel(v)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Showing what {view === "ALL" ? "every degree without its own entry" : `${view} students`} see.
            {canEdit ? " Click a day, then click another day to select a range." : " Hover over or tap a date for its full details."}
          </p>
          {month.error ? <Banner msg={{ ok: false, text: month.error.message }} /> : null}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center font-semibold text-muted-foreground">
                {w}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <div key={`lead-${i}`} />
            ))}
            {days.map((d) => {
              const selected = canEdit && from && to && d.date >= from && d.date <= to;
              const others = d.entries.filter((e) => e.applies_to !== view);
              const onIntern = internsOn(d.date);
              return (
                <Popover key={d.date}>
                  <PopoverTrigger
                    openOnHover
                    delay={200}
                    closeDelay={80}
                    render={
                      <button
                        type="button"
                        onClick={() => pick(d)}
                        aria-label={`${fmtDate(d.date)}: ${d.label || kindLabel(d.kind)}${d.in_term ? "" : ", outside term"}${onIntern.length ? `, ${onIntern.length} in internship` : ""}. Show details`}
                        className={cn(
                          "flex min-h-20 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                          KIND_INFO[d.kind].cell,
                          selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
                          !d.in_term && "opacity-50",
                          d.date === today && "outline outline-1 outline-offset-1 outline-primary",
                        )}
                      />
                    }
                  >
                    <span className="font-semibold">{Number(d.date.slice(8))}</span>
                    {d.kind !== "working" ? <span className="font-semibold">{kindLabel(d.kind)}</span> : null}
                    {d.label ? <span className="line-clamp-2 text-[11px] leading-tight text-sidebar-foreground">{d.label}</span> : null}
                    {!d.in_term ? (
                      <span className="text-[11px] text-muted-foreground">Outside term</span>
                    ) : !d.counted && d.kind === "event" ? (
                      <span className="text-[11px] text-muted-foreground">Not counted</span>
                    ) : null}
                    {others.map((e) => (
                      <span key={e.applies_to} className="text-[10px] text-muted-foreground">
                        {scopeLabel(e.applies_to)}: {kindLabel(e.day_type)}
                      </span>
                    ))}
                    {onIntern.length > 0 ? (
                      <span className="mt-auto flex items-center gap-1 text-[10px] font-semibold text-violet-800 dark:text-violet-300">
                        <span className={cn("inline-block size-2 rounded-full", CATEGORY_INFO.INTERNSHIP.dot)} aria-hidden="true" />
                        {onIntern.length} in internship
                      </span>
                    ) : null}
                  </PopoverTrigger>
                  <PopoverContent side="top" className="flex max-h-[min(70vh,30rem)] w-[min(20rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto">
                    <DayDetails d={d} view={view} interns={onIntern} />
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(["working", "holiday", "exam", "exam_prep", "event", "sunday"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={cn("inline-block size-3 rounded-sm border border-border", KIND_INFO[k].cell)} /> {KIND_INFO[k].label}
              </span>
            ))}
            <span>Faded = outside any term</span>
            <span>Hover over or tap a date for its full details</span>
          </p>
        </section>

        {canEdit ? (
          <EntryEditor
            key={prefill.key}
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            view={view}
            appliesOptions={month.data?.applies_to ?? ["ALL", "BITS", "CDU"]}
            prefill={prefill.entry}
          />
        ) : null}
      </div>

      <InternshipsCard month={shown} data={interns.data} error={interns.error} />
    </>
  );
}

const DAY_KIND = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "UTC" });
const LONG_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MAX_NAMES = 10;

function DegreeBlock({ b, muted }: { b: NonNullable<CalendarDay["by_degree"]>[number]; muted?: boolean }) {
  const scope = b.applies_to === "ALL" ? "All degrees" : b.applies_to ? `${b.applies_to} only` : "";
  const title = b.label || (b.kind === "working" ? "Class day" : b.kind === "sunday" ? "Sunday off" : kindLabel(b.kind));
  const detail = [b.label ? kindLabel(b.kind) : "", scope ? `Applies to: ${scope}` : b.kind === "working" ? "Default: Monday to Saturday" : ""].filter(Boolean);
  return (
    <div className={cn("flex flex-col gap-1 rounded-md px-3 py-2.5", muted ? "bg-surface-subtle/60 text-sidebar-foreground" : "bg-surface-subtle")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{b.degree}</span>
        <span className={cn("text-xs font-semibold", b.counted ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{b.counted ? "Counts" : "Not counted"}</span>
      </div>
      <span className="leading-snug font-semibold break-words">{title}</span>
      {detail.length ? <span className="text-xs text-muted-foreground">{detail.join(" · ")}</span> : null}
    </div>
  );
}

/** One date for every degree (the view's degree first), entries no degree uses, and who is on internship. */
function DayDetails({ d, view, interns }: { d: CalendarDay; view: string; interns: InternshipListItem[] }) {
  const all = d.by_degree ?? [];
  const mine = all.filter((b) => b.degree === view);
  const others = all.filter((b) => b.degree !== view);
  // Entries that decide no degree's day (each degree's own entry wins over ALL), so nothing saved is hidden.
  const shadowed = d.entries.filter((e) => !all.some((b) => b.applies_to === e.applies_to));
  const date = new Date(d.date + "T00:00:00Z");
  return (
    <>
      <header className="flex flex-col">
        <span className="text-xs text-muted-foreground">{DAY_KIND.format(date)}</span>
        <span className="text-[15px] font-semibold">{LONG_DATE.format(date)}</span>
      </header>
      {!d.in_term ? <p className="text-xs text-amber-700 dark:text-amber-400">Outside every term: no day counts.</p> : null}
      {view === "ALL" ? (
        <div className="flex flex-col gap-2">
          {all.map((b) => (
            <DegreeBlock key={b.degree} b={b} />
          ))}
        </div>
      ) : (
        <>
          {mine.map((b) => (
            <DegreeBlock key={b.degree} b={b} />
          ))}
          {others.length ? (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Other degrees</h4>
              {others.map((b) => (
                <DegreeBlock key={b.degree} b={b} muted />
              ))}
            </div>
          ) : null}
        </>
      )}
      {shadowed.length ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Also saved</h4>
          <ul className="flex flex-col gap-1 text-xs text-sidebar-foreground">
            {shadowed.map((e) => (
              <li key={e.applies_to}>
                {scopeLabel(e.applies_to)}: {kindLabel(e.day_type)}
                {e.label ? ` · ${e.label}` : ""} <span className="text-muted-foreground">(overridden by the degree&rsquo;s own entry)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {interns.length ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">On internship · {interns.length}</h4>
          <ul className="flex flex-col gap-0.5 text-xs text-sidebar-foreground">
            {interns.slice(0, MAX_NAMES).map((i) => (
              <li key={i.id} className="truncate">
                {i.name} <span className="text-muted-foreground">· {i.degree}</span>
              </li>
            ))}
          </ul>
          {interns.length > MAX_NAMES ? <p className="text-xs text-muted-foreground">and {interns.length - MAX_NAMES} more in the Internships table</p> : null}
        </div>
      ) : null}
    </>
  );
}

/** Every internship that touches the shown month. */
function InternshipsCard({ month, data, error }: { month: string; data?: { today: string; current: number; internships: InternshipListItem[] }; error: Error | null }) {
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const rows = (data?.internships ?? []).filter((i) => !onlyCurrent || i.current);
  return (
    <section aria-labelledby="cal-interns-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="cal-interns-h" className="text-[15px] font-bold">
            Internships{month ? ` in ${fmtMonth(month)}` : ""}
          </h3>
          <p className="text-[13px] text-muted-foreground">Internship days are marked Present. Assign, edit or cancel one from the student&rsquo;s page.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={onlyCurrent} onChange={(e) => setOnlyCurrent(e.target.checked)} />
          Only students in internship today ({data?.current ?? 0})
        </label>
      </div>
      {error ? (
        <p className="text-[13px] text-red-700 dark:text-red-400">Couldn&apos;t load internships: {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{data ? "No internships here." : "Loading…"}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-[13px]">
            <caption className="sr-only">Internships this month</caption>
            <thead className="bg-surface-subtle text-left text-xs text-muted-foreground">
              <tr>
                {["Student", "NIAT ID", "Degree · Section · Hall", "Internship", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/students/${i.niat_id}`} className="hover:text-primary hover:underline">
                      {i.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{i.niat_id}</td>
                  <td className="px-3 py-2">
                    {i.degree} · {i.section} · {i.hall_no || "No hall"}
                  </td>
                  <td className="px-3 py-2">
                    {fmtDate(i.start)} – {fmtDate(i.end)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                        i.current ? CATEGORY_INFO.INTERNSHIP.cls : "bg-muted text-sidebar-foreground ring-border",
                      )}
                    >
                      {PERIOD_STATE_LABEL[i.state]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Set or remove an entry for a day or range. Removing is previewed and archived (restorable from the Deletion log). */
function EntryEditor({
  from,
  to,
  setFrom,
  setTo,
  view,
  appliesOptions,
  prefill,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  view: string;
  appliesOptions: string[];
  prefill?: CalendarDay["entries"][number];
}) {
  const qc = useQueryClient();
  const [appliesTo, setAppliesTo] = useState(prefill?.applies_to ?? view);
  const [dayType, setDayType] = useState<DayType>(prefill?.day_type ?? "holiday");
  const [counts, setCounts] = useState(prefill ? prefill.counts : true);
  const [label, setLabel] = useState(prefill?.label ?? "");
  const [includeSundays, setIncludeSundays] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [removing, setRemoving] = useState<EntryKey[] | null>(null);

  // A calendar change moves every percentage, sheet and report: refresh everything.
  const done = (text: string) => {
    setMsg({ ok: true, text });
    void qc.invalidateQueries();
  };
  const onError = (e: Error) => setMsg({ ok: false, text: e.message });
  const save = useMutation({
    mutationFn: () =>
      attendanceApi.setCalendar({ from, to: to || from, applies_to: appliesTo, day_type: dayType, counts: dayType === "event" ? counts : undefined, label, include_sundays: includeSundays }),
    onSuccess: (r) =>
      done(
        (r.saved === 0 && r.unchanged ? `No changes: ${r.unchanged} date(s) already had this entry.` : `Saved ${r.saved} date(s).${r.unchanged ? ` ${r.unchanged} already the same.` : ""}`) +
          (r.warning ? ` ${r.warning}` : ""),
      ),
    onError,
  });
  // Remove: this scope's saved entries in the range, through the recoverable preview → delete flow.
  const findEntries = useMutation({
    mutationFn: async () => {
      const { entries } = await qc.fetchQuery({ queryKey: ["attendance", "calendar-entries"], queryFn: attendanceApi.calendarEntries, staleTime: 0 });
      const end = to || from;
      return entries.filter((e) => e.applies_to === appliesTo).flatMap((e) => e.dates.filter((date) => date >= from && date <= end).map((date) => ({ date, applies_to: appliesTo })));
    },
    onSuccess: (keys) => (keys.length ? setRemoving(keys) : setMsg({ ok: true, text: "Nothing to remove." })),
    onError,
  });
  const range = from ? (to && to !== from ? `${fmtDate(from)} to ${fmtDate(to)}` : fmtDate(from)) : "";

  return (
    <section aria-labelledby="cal-edit-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 id="cal-edit-h" className="text-[15px] font-bold">
          Edit days
        </h3>
        <p className="text-[13px] text-muted-foreground">{range ? `Selected: ${range}` : "Select a day or a range on the calendar, or enter dates here."}</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          if (!from) return setMsg({ ok: false, text: "Choose a start date." });
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            From
            <input className={fieldClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            To
            <input className={fieldClass} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Applies to
          <select className={fieldClass} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
            {appliesOptions.map((a) => (
              <option key={a} value={a}>
                {scopeLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Day type
          <select className={fieldClass} value={dayType} onChange={(e) => setDayType(e.target.value as DayType)}>
            <option value="holiday">Holiday (not counted)</option>
            <option value="exam">Exam (not counted)</option>
            <option value="exam_prep">Exam preparation (not counted)</option>
            <option value="event">Event</option>
            <option value="working">Working (counted, e.g. a make-up Sunday)</option>
          </select>
        </label>
        {dayType === "event" ? (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />
            Counts toward attendance
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Label (optional)
          <input className={fieldClass} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali, Hackathon" />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={includeSundays} onChange={(e) => setIncludeSundays(e.target.checked)} />
          Include Sundays in the range
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!from || findEntries.isPending}
            onClick={() => {
              setMsg(null);
              findEntries.mutate();
            }}
          >
            {findEntries.isPending ? "Checking…" : `Remove ${scopeLabel(appliesTo)} entries`}
          </Button>
        </div>
        <Banner msg={msg} />
      </form>
      <DeleteEntriesDialog
        keys={removing}
        onClose={() => setRemoving(null)}
        onDone={(text) => setMsg({ ok: true, text })}
        doneText={(n) => `Removed ${n} ${scopeLabel(appliesTo)} entr${n === 1 ? "y" : "ies"}; those days use the default rules again. They can be restored from the Deletion log.`}
      />
    </section>
  );
}
