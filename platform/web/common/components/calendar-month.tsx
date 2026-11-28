/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";

export type CalendarCell = {
  day: number | null;
  status: "present" | "absent" | "holiday" | "upcoming" | "blank";
  today?: boolean;
  /** Short reason a day has no class, shown under the date: "Sun", "Hol", "Exam", "Prep", … */
  tag?: string;
  /** The full reason, on hover and for screen readers (e.g. the holiday's name). */
  note?: string;
  /** An internship or registration-pending mark: the day takes that category's colour and label. */
  category?: "INTERNSHIP" | "REGISTRATION_PENDING";
};

/** DSA attendance student periods: internship days count as Present, registration-pending days as Absent. */
const CATEGORY: Record<NonNullable<CalendarCell["category"]>, { label: string; tag: string; mark: string; cls: string; swatch: string }> = {
  INTERNSHIP: {
    label: "Internship Period",
    tag: "Int",
    mark: "Present",
    cls: "bg-violet-100 text-violet-900 dark:bg-violet-950/70 dark:text-violet-200",
    swatch: "bg-violet-100 dark:bg-violet-950/70",
  },
  REGISTRATION_PENDING: {
    label: "Term 5 Registration Pending",
    tag: "Reg",
    mark: "Absent",
    cls: "bg-orange-100 text-orange-900 dark:bg-orange-950/70 dark:text-orange-200",
    swatch: "bg-orange-100 dark:bg-orange-950/70",
  },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STYLE: Record<CalendarCell["status"], string> = {
  present: "bg-[#DCE4FB] dark:bg-[#1E2A52] text-accent-strong",
  absent: "bg-[#F8D9C2] dark:bg-[#4A2A14] text-[#6E3005] dark:text-[#F5B98A]",
  holiday: "bg-muted text-muted-foreground",
  upcoming: "border border-border bg-card text-[#6B7080] dark:text-[#A3A9B7]",
  blank: "",
};
const TAG: Record<CalendarCell["status"], string> = { present: "P", absent: "A", holiday: "Off", upcoming: "", blank: "" };
const SR: Record<CalendarCell["status"], string> = { present: "present", absent: "absent", holiday: "holiday", upcoming: "upcoming", blank: "" };

/**
 * Month grid (Mon–Sun) for attendance. Each day shows a letter as well as a colour,
 * so status never depends on colour alone.
 */
export function CalendarMonth({ label, cells }: { label: string; cells: CalendarCell[] }) {
  const categories = [...new Set(cells.map((c) => c.category).filter((c): c is NonNullable<CalendarCell["category"]> => !!c))];
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-xs" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center font-semibold text-muted-foreground">
            {day}
          </span>
        ))}
      </div>
      <ol aria-label={label} className="mt-1.5 grid grid-cols-7 gap-1.5 text-xs">
        {cells.map((cell, i) => {
          if (cell.day === null) return <li key={`b${i}`} aria-hidden="true" />;
          const cat = cell.category ? CATEGORY[cell.category] : null;
          const note = cat ? `${cat.label} (counted as ${cat.mark})` : cell.note;
          return (
            <li
              key={cell.day}
              className={cn(
                "flex h-10 flex-col items-center justify-center rounded-md leading-tight",
                cat ? cat.cls : STYLE[cell.status],
                cat && cell.status === "upcoming" && "opacity-60",
                cell.today && "ring-2 ring-accent-strong",
              )}
              title={note || undefined}
            >
              <span className="text-xs font-semibold" aria-hidden="true">{cell.day}</span>
              <span className="text-[10px] font-bold" aria-hidden="true">{cat ? cat.tag : (cell.tag ?? TAG[cell.status])}</span>
              <span className="sr-only">{`${cell.day}: ${note || SR[cell.status]}${cell.today ? ", today" : ""}`}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#DCE4FB] dark:bg-[#1E2A52]" />P · present</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[#F8D9C2] dark:bg-[#4A2A14]" />A · absent</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-muted" />No class · Sun, holiday, exam</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-border bg-card" />Upcoming</span>
        {categories.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CATEGORY[c].swatch)} />
            {CATEGORY[c].tag} · {CATEGORY[c].label} (counted as {CATEGORY[c].mark})
          </span>
        ))}
      </div>
    </div>
  );
}
