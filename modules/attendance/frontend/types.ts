/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

/**
 * Shapes of the attendance service's JSON (modules/attendance/backend), copied from
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

/* ---------- Analytics (Owner only; GET /api/admin/analytics) ---------- */

export type AnalyticsPeriod = "today" | "last7" | "lastmonth" | "custom";

/** Student-day counts for a group. Over several days present / absent are student-days. */
export type Tally = {
  students: number;
  present: number;
  absent: number;
  unmarked: number;
  unmarked_students: number;
  working_days: number;
  pct: number | null;
  avg_present: number | null;
  avg_absent: number | null;
};
export type GroupTally = Tally & { degree: string; hall?: string };
export type DayTally = { date: string; students: number; present: number; absent: number; unmarked: number; pct: number | null };

export type AnalyticsQuery = {
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
  degree?: string;
  /** undefined: all halls; "": students with no hall. */
  hall?: string;
  section?: string;
};

export type Analytics = {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  today: string;
  days: number;
  generated_at: string;
  filter: { degree: string; hall: string | null; section: string };
  options: { degrees: string[]; halls: { degree: string; value: string }[]; sections: { degree: string; value: string }[] };
  total: Tally;
  degrees: GroupTally[];
  halls: GroupTally[];
  daily: DayTally[];
  insights: {
    top_degrees: string[];
    top_degree_pct: number | null;
    top_halls: string[];
    top_hall_pct: number | null;
    bottom_halls: string[];
    bottom_hall_pct: number | null;
    change: number | null;
    prev_pct: number | null;
  };
  previous: { from: string; to: string; total: Tally };
};

/** Which students a drill-down lists: everyone eligible, or those with at least one such day. */
export type AnalyticsShow = "all" | "present" | "absent" | "unmarked";
export type AnalyticsStudent = {
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  hall_no: string;
  present: number;
  absent: number;
  unmarked: number;
  pct: number | null;
};

/* ---------- Imports (POST /api/admin/imports/{students|attendance|calendar}) ---------- */

/** A date between the first and last attendance columns with no column of its own (Sundays excluded). */
export type MissingDate = { date: string; weekday: number; entries: CalendarEntry[]; has_marks: boolean };

export type ImportRow = {
  row: number;
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  action: "new" | "update" | "unchanged" | "error";
  errors: string[];
  warnings: string[];
};

export type ImportResult = {
  file_name: string;
  /** reordered: unchanged students whose row position (used by Export) would change. */
  summary: { total: number; new: number; updated: number; unchanged: number; errors: number; warnings: number; reordered: number };
  rows: ImportRow[];
  committed: boolean;
  saved: number;
  /** The sheet's date columns, when it has any; saved by the same commit. */
  attendance?: AttendanceImportResult;
};

export type AttendanceImportRow = {
  row: number;
  niat_id: string;
  name: string;
  status: "update" | "unchanged" | "error";
  changes: number;
  unchanged: number;
  blank: number;
  skipped: string[];
  errors: string[];
  warnings: string[];
};

export type AttendanceImportResult = {
  file_name: string;
  dates: string[];
  /** Unreadable date headers; read only once given a date. suggested is "" when there is no guess. */
  bad_columns: { column: number; header: string; suggested: string }[];
  header_errors: string[];
  header_warnings: string[];
  missing_dates: MissingDate[];
  summary: {
    rows: number;
    students_affected: number;
    records_to_update: number;
    unchanged_records: number;
    blank_cells: number;
    skipped_cells: number;
    error_rows: number;
    /** Internship / registration periods created or changed by the save. */
    periods_to_save: number;
  };
  /** Recognised categories: the mark each saves, how many cells, first and last date. */
  categories: { category: PeriodKind; status: "P" | "A"; cells: number; from: string; to: string }[];
  /** Values that are not saved (e.g. #REF!), most frequent first. */
  unsupported: { value: string; cells: number; reason: string }[];
  /** Values the admin mapped to Present or Absent. */
  mapped: { value: string; status: "P" | "A"; cells: number }[];
  /** Headers that are neither a date nor a student column; not read. */
  ignored_columns: string[];
  periods: { niat_id: string; name: string; kind: PeriodKind; start: string; end: string; completed_on: string; action: "new" | "extend" | "unchanged" }[];
  rows: AttendanceImportRow[];
  committed: boolean;
  saved: number;
};

export type CalendarImportRow = {
  row: number;
  date: string;
  day_type: string;
  applies_to: string;
  label: string;
  counts: boolean;
  action: "new" | "update" | "unchanged" | "error";
  errors: string[];
  warnings: string[];
};

export type CalendarImportResult = {
  file_name: string;
  summary: { total: number; new: number; updated: number; unchanged: number; errors: number; warnings: number };
  rows: CalendarImportRow[];
  committed: boolean;
  saved: number;
  batch_id?: number;
};

/**
 * columnDates gives a date (YYYY-MM-DD) to unreadable date headers, by 0-based column.
 * valueMap maps values that are not marks (as written in the sheet) to Present or Absent.
 */
export type UploadOpts = { commit?: boolean; skipErrors?: boolean; columnDates?: Record<number, string>; valueMap?: Record<string, "P" | "A"> };

/* ---------- Export (GET /api/admin/exports/attendance) ---------- */

/** One student in the attendance export: one value per date, "" when nothing is saved. */
export type ExportRow = { niat_id: string; name: string; section: string; dropped: boolean; values: string[] };

export type ExportDegree = {
  degree: string;
  /** In the order of the last student import file. */
  rows: ExportRow[];
  /** Class days of active students with no mark yet. */
  unmarked: number;
  /** Students with no position from a student import (listed last). */
  unordered: number;
};

export type AttendanceExport = {
  from: string;
  to: string;
  today: string;
  dates: string[];
  /** Column headers as in the master sheet, e.g. 13-Nov-2026. */
  headers: string[];
  degrees: ExportDegree[];
};
