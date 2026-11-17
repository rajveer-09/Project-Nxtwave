/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

/**
 * Shapes of the attendance service's JSON (services/attendance-api), copied from
 * Nxtwave-attendance-dashboard/web/lib/api.ts so the screens match the Go API exactly.
 */
export type Mark = "P" | "A" | null;

export type Hall = { hall: string; students: number };

export type SheetRow = {
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  hall_no: string;
  /** False when the date doesn't count for this student (Sunday, holiday, future, outside the term…). */
  counted: boolean;
  /** Why the day can't be marked, when !counted. */
  reason: string;
  status: Mark;
};

export type Sheet = { date: string; today: string; students: SheetRow[] };

export type MarkInput = { niat_id: string; date: string; status: Mark };

export type SaveResult = { saved: number; cleared: number };

export type DayType = "working" | "holiday" | "exam" | "exam_prep" | "event";

export type CalendarEntry = { applies_to: string; day_type: DayType; counts: boolean; label: string };

export type CalendarDay = {
  date: string;
  weekday: number;
  kind: DayType | "sunday";
  label: string;
  applies_to: string;
  in_term: boolean;
  counted: boolean;
  entries: CalendarEntry[];
};

export type CalendarMonth = { month: string; view: string; today: string; applies_to: string[]; days: CalendarDay[] };

export type TermRow = { id: number; name: string; start: string; end: string; is_current: boolean };

export type PeriodKind = "INTERNSHIP" | "REGISTRATION_PENDING";

export type InternshipListItem = {
  id: number;
  kind: PeriodKind;
  start: string;
  end: string;
  state: "upcoming" | "active" | "ended" | "pending" | "completed" | "cancelled";
  calendar_days: number;
  attendance_days: number;
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  hall_no: string;
  current: boolean;
};
