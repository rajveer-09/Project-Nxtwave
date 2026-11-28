/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { ApiError, apiFetch } from "@/common/lib/api-client";
import type {
  Analytics,
  AnalyticsQuery,
  AnalyticsShow,
  AnalyticsStudent,
  AttendanceExport,
  AttendanceImportResult,
  CalendarDeletion,
  CalendarEntryRange,
  CalendarImpact,
  CalendarImportResult,
  CalendarMonth,
  DayType,
  DeletedEntry,
  DeletionPreview,
  DeletionSelector,
  EntryKey,
  Hall,
  ImportBatch,
  ImportResult,
  InternshipInput,
  InternshipListItem,
  InternshipResult,
  MarkInput,
  Profile,
  RangeResult,
  SaveResult,
  Sheet,
  StudentFilters,
  StudentForm,
  StudentList,
  StudentMonth,
  TermRow,
  UploadOpts,
} from "@nxtone/attendance-ui/types";

/** Attendance service calls, always through the same-origin proxy /api/attendance/*. */
const base = "/api/attendance/admin";

/** Query string for the analytics routes (the same parameters as the Go handler). */
function analyticsParams(q: AnalyticsQuery) {
  const qs = new URLSearchParams({ period: q.period });
  if (q.period === "custom" && q.from && q.to) {
    qs.set("from", q.from);
    qs.set("to", q.to);
  }
  if (q.degree) qs.set("degree", q.degree);
  if (q.hall !== undefined) qs.set("hall", q.hall);
  if (q.section) qs.set("section", q.section);
  return qs;
}

export const attendanceApi = {
  halls: () => apiFetch<{ halls: Hall[] }>(`${base}/halls`),
  sheet: (date: string, hall: string) => apiFetch<Sheet>(`${base}/attendance/sheet?${new URLSearchParams({ date, hall })}`),
  saveMarks: (marks: MarkInput[]) => apiFetch<SaveResult>(`${base}/attendance`, { method: "PUT", json: marks }),
  calendar: (ym: string, view: string) => apiFetch<CalendarMonth>(`${base}/calendar?${new URLSearchParams({ ym, view })}`),
  terms: () => apiFetch<{ terms: TermRow[]; today: string }>(`${base}/terms`),
  internships: (from: string, to: string) =>
    apiFetch<{ today: string; current: number; internships: InternshipListItem[] }>(`${base}/internships?${new URLSearchParams({ from, to })}`),
  /** Owner-only report: every number comes from the service (stats.Analyze). */
  analytics: (q: AnalyticsQuery) => apiFetch<Analytics>(`${base}/analytics?${analyticsParams(q)}`),
  /** The students behind a card or a degree / hall row (Owner only). */
  analyticsStudents: (q: AnalyticsQuery, show: AnalyticsShow) => {
    const qs = analyticsParams(q);
    qs.set("show", show);
    return apiFetch<{ from: string; to: string; show: AnalyticsShow; students: AnalyticsStudent[] }>(`${base}/analytics/students?${qs}`);
  },
  /** The same report as an Excel workbook (aggregates only; no student is named). */
  analyticsExcel: async (q: AnalyticsQuery): Promise<{ blob: Blob; name: string }> => {
    const res = await fetch(`${base}/analytics/export.xlsx?${analyticsParams(q)}`, { credentials: "same-origin" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error?.message ?? (typeof body?.error === "string" ? body.error : `Export failed (${res.status}).`);
      throw new ApiError(res.status, message);
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "attendance-analytics.xlsx";
    return { blob: await res.blob(), name };
  },

  /* ---------- imports: a preview by default; commit saves ---------- */
  importStudents: (file: File, opts: UploadOpts = {}) => uploadSheet<ImportResult>("students", file, opts),
  importAttendance: (file: File, opts: UploadOpts = {}) => uploadSheet<AttendanceImportResult>("attendance", file, opts),
  importCalendar: (file: File, opts: UploadOpts = {}) => uploadSheet<CalendarImportResult>("calendar", file, opts),
  /**
   * Save single-date calendar entries in one go (e.g. picked missing dates).
   * upload records them as coming from that sheet in the import history.
   */
  saveCalendarEntries: (entries: { date: string; applies_to: string; day_type: DayType; label: string }[], upload?: { file_name: string; kind: "attendance" | "students" }) =>
    apiFetch<{ saved: number; unchanged: number; warning?: string; batch_id?: number }>(`${base}/calendar/entries`, { method: "PUT", json: { entries, ...upload } }),

  /* ---------- export for the master sheet ---------- */
  /** Saved attendance per degree for the dates; both blank means today. */
  exportAttendance: (from: string, to: string) => apiFetch<AttendanceExport>(`${base}/exports/attendance?${exportParams(from, to)}`),
  /** The same as an Excel workbook, one tab per degree. */
  exportExcel: (from: string, to: string) => download(`${base}/exports/attendance.xlsx?${exportParams(from, to)}`, "attendance.xlsx"),

  /* ---------- students (Owners and admins; deleting is Owner only) ---------- */
  students: (f: StudentFilters = {}) => {
    const qs = new URLSearchParams({ q: f.q ?? "", degree: f.degree ?? "", section: f.section ?? "" });
    if (f.hall !== undefined) qs.set("hall", f.hall);
    if (f.term) qs.set("term", f.term);
    if (f.presentToday) qs.set("present", "today");
    if (f.from && f.to) {
      qs.set("from", f.from);
      qs.set("to", f.to);
    }
    return apiFetch<StudentList>(`${base}/students?${qs}`);
  },
  /** The student's own profile plus admin-only fields, for any status and term ("" = current). */
  student: (id: string, term = "") => apiFetch<Profile>(`${base}/students/${encodeURIComponent(id)}${term ? `?${new URLSearchParams({ term })}` : ""}`),
  studentMonth: (id: string, ym: string) => apiFetch<StudentMonth>(`${base}/students/${encodeURIComponent(id)}/month?${new URLSearchParams({ ym })}`),
  studentRange: (id: string, from: string, to: string) =>
    apiFetch<RangeResult>(`${base}/students/${encodeURIComponent(id)}/range?${new URLSearchParams({ from, to })}`),
  /** Sets the month's remark (YYYY-MM); an empty remark deletes it. */
  setRemark: (id: string, ym: string, remark: string) =>
    apiFetch<{ month: string; remark: string }>(`${base}/students/${encodeURIComponent(id)}/remarks/${ym}`, { method: "PUT", json: { remark } }),
  createStudent: (f: StudentForm) => apiFetch<{ niat_id: string }>(`${base}/students`, { method: "POST", json: f }),
  updateStudent: (id: string, f: StudentForm) => apiFetch<{ niat_id: string }>(`${base}/students/${encodeURIComponent(id)}`, { method: "PUT", json: f }),
  /** Owner only: the student and all their marks; confirm repeats the NIAT ID. */
  deleteStudent: (id: string, confirm: string) =>
    apiFetch<{ deleted: string; marks_deleted: number }>(`${base}/students/${encodeURIComponent(id)}?${new URLSearchParams({ confirm })}`, { method: "DELETE" }),
  /** Owner only: confirm must be "DELETE <count>". */
  deleteStudents: (niatIds: string[], confirm: string) =>
    apiFetch<{ deleted: number; not_found: number; marks_deleted: number }>(`${base}/students/bulk-delete`, { method: "POST", json: { niat_ids: niatIds, confirm } }),
  createInternship: (id: string, input: InternshipInput) =>
    apiFetch<InternshipResult>(`${base}/students/${encodeURIComponent(id)}/internships`, { method: "POST", json: input }),
  updateInternship: (periodId: number, input: InternshipInput) => apiFetch<InternshipResult>(`${base}/internships/${periodId}`, { method: "PUT", json: input }),
  cancelInternship: (periodId: number) => apiFetch<{ cancelled: number; marks_removed: number }>(`${base}/internships/${periodId}/cancel`, { method: "POST" }),

  /* ---------- calendar editing (Owners and admins; resetting imported entries is Owner only) ---------- */
  /** Month view Save: one entry per date in from..to for the scope (Sundays only when asked). */
  setCalendar: (e: { from: string; to: string; applies_to: string; day_type: DayType; counts?: boolean; label: string; include_sundays: boolean }) =>
    apiFetch<{ saved: number; unchanged: number; warning?: string }>(`${base}/calendar`, { method: "PUT", json: e }),
  calendarEntries: () => apiFetch<{ entries: CalendarEntryRange[] }>(`${base}/calendar/entries`),
  importHistory: () => apiFetch<{ batches: ImportBatch[] }>(`${base}/imports/history`),
  previewDeletion: (sel: DeletionSelector) => apiFetch<DeletionPreview>(`${base}/calendar/deletions/preview`, { method: "POST", json: sel }),
  /** confirm: true for selected entries; "RESET <count>" for a reset of imported entries. */
  deleteEntries: (sel: DeletionSelector, token: string, confirm: true | string) =>
    apiFetch<{ deletion_id: number; deleted: number; impact: CalendarImpact }>(`${base}/calendar/deletions`, {
      method: "POST",
      json: { ...sel, token, ...(confirm === true ? { confirmed: true } : { confirm }) },
    }),
  editEntries: (e: { entries: EntryKey[]; token: string; day_type: DayType; counts?: boolean; label: string }) =>
    apiFetch<{ updated: number; impact: CalendarImpact }>(`${base}/calendar/entries`, { method: "PATCH", json: e }),
  deletions: () => apiFetch<{ deletions: CalendarDeletion[] }>(`${base}/calendar/deletions`),
  deletion: (id: number) => apiFetch<{ entries: DeletedEntry[] }>(`${base}/calendar/deletions/${id}`),
  restoreDeletion: (id: number) => apiFetch<{ restored: number; skipped: number }>(`${base}/calendar/deletions/${id}/restore`, { method: "POST" }),
};

const exportParams = (from: string, to: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return qs;
};

/** The service's error message from a failed response, whatever its shape. */
async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? (typeof body?.error === "string" ? body.error : fallback);
}

async function download(path: string, fallbackName: string): Promise<{ blob: Blob; name: string }> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res, `Export failed (${res.status}).`));
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  return { blob: await res.blob(), name };
}

/** Uploads a sheet to an import endpoint: a preview by default, or saves it with commit. */
async function uploadSheet<T>(kind: "students" | "attendance" | "calendar", file: File, opts: UploadOpts): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  if (opts.columnDates && Object.keys(opts.columnDates).length > 0) form.append("column_dates", JSON.stringify(opts.columnDates));
  if (opts.valueMap && Object.keys(opts.valueMap).length > 0) form.append("value_map", JSON.stringify(opts.valueMap));
  const qs = new URLSearchParams({ commit: String(!!opts.commit), skip_errors: String(!!opts.skipErrors) });
  const res = await fetch(`${base}/imports/${kind}?${qs}`, { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res, `Upload failed (${res.status}).`));
  return (await res.json()) as T;
}
