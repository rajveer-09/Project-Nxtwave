/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import { apiFetch } from "@/common/lib/api-client";
import type { CalendarMonth, Hall, InternshipListItem, MarkInput, SaveResult, Sheet, TermRow } from "@/modules/attendance/types";

/** Attendance service calls, always through the same-origin proxy /api/attendance/*. */
const base = "/api/attendance/admin";

export const attendanceApi = {
  halls: () => apiFetch<{ halls: Hall[] }>(`${base}/halls`),
  sheet: (date: string, hall: string) => apiFetch<Sheet>(`${base}/attendance/sheet?${new URLSearchParams({ date, hall })}`),
  saveMarks: (marks: MarkInput[]) => apiFetch<SaveResult>(`${base}/attendance`, { method: "PUT", json: marks }),
  calendar: (ym: string, view: string) => apiFetch<CalendarMonth>(`${base}/calendar?${new URLSearchParams({ ym, view })}`),
  terms: () => apiFetch<{ terms: TermRow[]; today: string }>(`${base}/terms`),
  internships: (from: string, to: string) =>
    apiFetch<{ today: string; current: number; internships: InternshipListItem[] }>(`${base}/internships?${new URLSearchParams({ from, to })}`),
};
