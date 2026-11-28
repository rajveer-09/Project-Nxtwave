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
  /** Who last saved the mark: Owner only (never sent to anyone else), and only when there is a mark. name "" = unknown. */
  saved_by?: { name: string; at: string };
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
  /** How every degree's students see this date (a degree-specific entry only ever under its own degree). */
  by_degree?: { degree: string; kind: DayType | "sunday"; label: string; counted: boolean; applies_to: string }[];
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

/* ---------- Students (GET/POST/PUT/DELETE /api/admin/students…; Owners and admins) ---------- */

export type Band = "below_60" | "60_to_75" | "75_plus" | "none";

/** One student's counted days over a period (stats.Summary). */
export type Summary = {
  counted_days: number;
  days_attended: number;
  days_absent: number;
  not_marked_days: number;
  /** Present + Absent: the counted days with a mark (the % is taken over these; "working days" in the UI). */
  marked_days: number;
  pct: number | null;
  band: Band;
};

export type Term = { id: number; name: string; start: string; end: string } | null;

/** The group numbers for the summary cards (stats.Overview). */
export type Overview = {
  students: number;
  average_pct: number | null;
  below_threshold: number;
  threshold: number;
  bands: Record<Band, number>;
};

export type AdminStudent = {
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  /** "" when the student has no hall. */
  hall_no: string;
  status: string;
  /** N99 demo data. */
  demo: boolean;
  summary: Summary;
  band: Band;
};

/** hall "" means students with no hall, undefined any hall; term is a term id, "" the current term. */
export type StudentFilters = { q?: string; degree?: string; section?: string; hall?: string; term?: string; from?: string; to?: string; presentToday?: boolean };

export type StudentList = {
  term: Term;
  today: string;
  range: { from: string; to: string; custom: boolean };
  students: AdminStudent[];
  overview: Overview;
};

/** An internship or registration-pending period of one student. */
export type Period = {
  id: number;
  kind: PeriodKind;
  start: string;
  end: string;
  /** Registration only: the day an import showed it done; "" while pending. */
  completed_on: string;
  source: "admin" | "import";
  state: "upcoming" | "active" | "ended" | "pending" | "completed" | "cancelled";
  calendar_days: number;
  /** Days in the period that count for attendance, up to today. */
  attendance_days: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string;
};

/** Standing against the placement threshold (95%); every number comes from the service. */
export type Placement = {
  threshold: number;
  pct: number | null;
  below: boolean;
  days_needed: number;
  /** Percentage points short (0 when met); null when nothing is marked. */
  gap: number | null;
  months: { month: string; pct: number | null; below: boolean }[];
};

export type ProfileStudent = {
  niat_id: string;
  name: string;
  degree: string;
  section: string;
  level?: string;
  hall_no: string;
  poc: string;
  coach: string;
  status: string;
  /** "" when blank (counts from the term start). */
  joined_on?: string;
  /** "" when not dropped. */
  dropped_on?: string;
  demo?: boolean;
};

/** GET /api/admin/students/{id}: the student's own profile plus admin-only fields. */
export type Profile = {
  student: ProfileStudent;
  term: Term;
  today: string;
  summary: Summary;
  months: (Summary & { month: string })[];
  placement: Placement;
  /** Remarks by month (YYYY-MM). */
  remarks: Record<string, string>;
  periods: Period[];
};

export type MonthDay = {
  date: string;
  weekday: number; // 0 = Sunday
  kind: string;
  label: string;
  /** Scope of the calendar entry that decided the day: the student's degree, "ALL", or "" (default rule). */
  applies_to: string;
  excluded: string;
  counted: boolean;
  status: Mark;
  category: PeriodKind | "";
};

export type StudentMonth = { month: string; today: string; days: MonthDay[]; summary: Summary };

export type RangeResult = { from: string; to: string; summary: Summary; clipped: boolean; outside_term: boolean };

/** The add / edit form. Blank optional fields are stored empty; poc and coach are names. */
export type StudentForm = {
  niat_id?: string;
  name: string;
  degree: string;
  section: string;
  level: string;
  hall_no: string;
  poc: string;
  coach: string;
  status: "active" | "dropped";
  joined_on: string;
  dropped_on: string;
};

export type InternshipConflict = { date: string; status: "P" | "A"; category: PeriodKind | "" };

export type InternshipResult = {
  dry_run: boolean;
  period: Period | null;
  days: number;
  conflicts: InternshipConflict[];
  marks_saved: number;
  marks_kept: number;
  marks_removed: number;
};

export type InternshipInput = { start: string; end: string; overwrite?: boolean; dry_run?: boolean };

/* ---------- Calendar entries, deletions and import history (Owners and admins; resets Owner only) ---------- */

export type EntrySource = "legacy" | "manual" | "calendar_import" | "attendance_import" | "students_import";
export type AdminRef = { name: string; email: string } | null;

/** Consecutive calendar days saved together (a Sunday with no entry is skipped over). */
export type CalendarEntryRange = {
  start: string;
  end: string;
  days: number;
  applies_to: string;
  day_type: DayType;
  counts: boolean;
  label: string;
  source: EntrySource;
  batch: { id: number; file_name: string; kind: string } | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: AdminRef;
  updated_by: AdminRef;
  dates: string[];
  /** Fingerprint of these rows; an edit or deletion is refused if they changed since. */
  token: string;
};

export type EntryKey = { date: string; applies_to: string };

export type DeletionSelector =
  | { mode: "selected"; entries: EntryKey[] }
  | { mode: "imported"; batch_ids?: number[]; degrees?: string[]; types?: DayType[]; from?: string; to?: string };

export type ImpactDay = { kind: DayType | "sunday"; label: string; counts: boolean; counted: boolean };
export type CalendarImpact = {
  changes: { date: string; degree: string; before: ImpactDay; after: ImpactDay; counting_changes: boolean; marks: number }[];
  start_counting: number;
  stop_counting: number;
  marks_start: number;
  marks_stop: number;
};

export type DeletionPreview = {
  entries: CalendarEntryRange[];
  count: number;
  dates: string[];
  degrees: string[];
  types: Record<string, number>;
  kept: { manual: number; legacy: number };
  missing: number;
  impact: CalendarImpact;
  token: string;
};

export type CalendarDeletion = {
  id: number;
  kind: "selected" | "imported";
  criteria: { dates?: string[]; degrees?: string[]; types?: Record<string, number>; kept?: { manual: number; legacy: number } };
  entry_count: number;
  deleted_at: string;
  deleted_by: AdminRef;
  restored_at: string | null;
  restored_by: AdminRef;
  restored_entries: number;
};

export type DeletedEntry = { date: string; applies_to: string; day_type: DayType; counts: boolean; label: string; source: EntrySource; file_name: string; restored: boolean };

/** A saved upload that wrote calendar entries. */
export type ImportBatch = {
  id: number;
  kind: "calendar" | "attendance" | "students";
  file_name: string;
  status: string;
  uploaded_at: string;
  uploaded_by: AdminRef;
  summary: { created: number; updated: number; unchanged: number; skipped: number; from?: string; to?: string; degrees: string[] };
  current_entries: number;
};
