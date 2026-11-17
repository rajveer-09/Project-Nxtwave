/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

/**
 * Weekly tests (ARCHITECTURE §4.7). Admins design a versioned result format; each
 * test is tied to the format version it was created with; instructors fill one
 * result per student; submitting locks their rows until an admin unlocks them.
 */
export const FIELD_TYPES = ["marks", "number", "single", "multi", "short", "long", "yesno", "rating"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, { name: string; hint: string }> = {
  marks: { name: "Marks", hint: "Numbers that add to the total" },
  number: { name: "Number", hint: "Not added to the total" },
  single: { name: "Single choice", hint: "Dropdown" },
  multi: { name: "Multiple choice", hint: "Chips, pick many" },
  short: { name: "Short text", hint: "One line" },
  long: { name: "Long text", hint: "Paragraph" },
  yesno: { name: "Yes / No", hint: "Toggle" },
  rating: { name: "Rating 1–5", hint: "Quick score" },
};

export type FormatField = {
  id: string;
  label: string;
  type: FieldType;
  help: string;
  required: boolean;
  /** Shown as a column in the marks table; otherwise in the per-student feedback panel. */
  column: boolean;
  max?: number;
  options?: string[];
};

export type FormatVersion = { version: number; passMark: number; fields: FormatField[]; publishedBy: string; publishedAt: string };
export type ResultFormat = { id: string; name: string; versions: FormatVersion[] };

export const BANDS = ["L0", "L1", "L2", "L3+"] as const;
export type Band = (typeof BANDS)[number];
export const bandOf = (level: number): Band => (level <= 0 ? "L0" : level === 1 ? "L1" : level === 2 ? "L2" : "L3+");

export type WeeklyTest = {
  id: string;
  name: string;
  band: Band;
  heldOn: string; // YYYY-MM-DD
  dueAt: string; // ISO
  formatId: string;
  version: number;
  createdBy: string;
};

export type ResultValue = number | string | string[] | boolean | null;

export type TestResult = {
  testId: string;
  niatId: string;
  present: boolean;
  values: Record<string, ResultValue>;
  enteredBy: string;
  updatedAt: string;
};

export type Submission = { testId: string; instructor: string; submittedAt: string };

export const maxTotal = (fields: FormatField[]) => fields.filter((f) => f.type === "marks").reduce((n, f) => n + (f.max ?? 0), 0);

export function totalOf(fields: FormatField[], values: Record<string, ResultValue>): number | null {
  const marks = fields.filter((f) => f.type === "marks");
  if (marks.some((f) => typeof values[f.id] !== "number")) return null;
  return marks.reduce((n, f) => n + (values[f.id] as number), 0);
}

const empty = (v: ResultValue | undefined) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Problems with one student's result under a format; empty when it can be submitted. */
export function resultProblems(fields: FormatField[], result: Pick<TestResult, "present" | "values">): string[] {
  if (!result.present) return [];
  const problems: string[] = [];
  for (const f of fields) {
    const v = result.values[f.id];
    if (empty(v)) {
      if (f.required) problems.push(`${f.label} is required`);
      continue;
    }
    if (f.type === "marks" || f.type === "number" || f.type === "rating") {
      if (typeof v !== "number" || Number.isNaN(v)) problems.push(`${f.label} must be a number`);
      else if (v < 0 || (f.type === "marks" && f.max !== undefined && v > f.max) || (f.type === "rating" && (v < 1 || v > 5)))
        problems.push(`${f.label} is out of range`);
    } else if (f.type === "single" && !(f.options ?? []).includes(String(v))) problems.push(`${f.label}: pick one of the options`);
    else if (f.type === "multi" && (!Array.isArray(v) || v.some((x) => !(f.options ?? []).includes(x)))) problems.push(`${f.label}: unknown option`);
    else if (f.type === "yesno" && typeof v !== "boolean") problems.push(`${f.label} must be yes or no`);
    else if ((f.type === "short" || f.type === "long") && typeof v === "string" && v.length > 4000) problems.push(`${f.label} is too long`);
  }
  return problems;
}
