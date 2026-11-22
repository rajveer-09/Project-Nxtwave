/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/common/components/confirm";
import { Dropdown } from "@/common/components/dropdown";
import { Button, buttonVariants } from "@/common/ui/button";
import { applyImportAction, assignAction, previewImportAction } from "@/modules/admin/actions";
import type { ImportPreview, StaffOption } from "@/modules/admin/assignments-data";


/** Instructor or coach picker for one student; asks to confirm (with before → after) before saving. */
export function AssignSelect({ niatId, student, kind, current, options }: { niatId: string; student: string; kind: "instructor" | "coach"; current: string; options: StaffOption[] }) {
  const { ask, dialog } = useConfirm();
  const currentId = options.find((o) => o.name === current)?.id ?? "";
  const [value, setValue] = useState(currentId);
  const label = kind === "coach" ? "Success coach" : "Instructor";
  const none = kind === "coach" ? "No coach" : "Unassigned";
  return (
    <>
      <Dropdown
        aria-label={`${label} for ${student}`}
        className="h-9 w-full min-w-44 text-[13px]"
        value={value}
        searchPlaceholder={kind === "coach" ? "Search coaches…" : "Search instructors…"}
        options={[
          { value: "", label: kind === "coach" ? "No coach" : current && current !== "Unassigned" && !currentId ? `${current} (inactive)` : "Unassigned" },
          ...options.map((o) => ({ value: o.id, label: o.name })),
        ]}
        onValueChange={(next) => {
          setValue(next);
          const to = options.find((o) => o.id === next)?.name ?? none;
          ask({
            title: `Change ${student}'s ${label.toLowerCase()}?`,
            changes: [
              { label: "Student", after: `${student} · ${niatId}` },
              { label, before: current && current !== "Unassigned" ? current : none, after: to },
            ],
            description: kind === "instructor" ? "History is kept, the change goes to the change log, and the Interactions app shows the new instructor too." : "History is kept and the change goes to the change log.",
            confirmLabel: "Save change",
            action: () => assignAction(niatId, kind, next || null),
            onCancel: () => setValue(currentId),
          });
        }}
      />
      {dialog}
    </>
  );
}

/** Upload an Excel or CSV file, check the preview, then apply. Logged as "Excel import" with the file name. */
export function ImportPanel() {
  const { ask, dialog } = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  function check(form: FormData) {
    startTransition(async () => {
      const result = await previewImportAction(form);
      if (result.ok) setPreview(result.preview);
      else toast.error(result.error);
    });
  }

  function apply() {
    if (!preview) return;
    const changes = preview.rows.filter((r) => !r.error && (r.instructor || r.coach));
    ask({
      title: `Apply ${preview.changes} change${preview.changes === 1 ? "" : "s"} from ${preview.fileName}?`,
      description: `${preview.errors ? `${preview.errors} row${preview.errors === 1 ? "" : "s"} with problems will be skipped. ` : ""}Each change keeps history and goes to the change log as an Excel import with the file name.`,
      items: changes.map(
        (r) =>
          `${r.student ?? r.niatId}: ${[r.instructor ? `instructor ${r.instructor.from} → ${r.instructor.to ?? "none"}` : "", r.coach ? `coach ${r.coach.from} → ${r.coach.to ?? "none"}` : ""]
            .filter(Boolean)
            .join(", ")}`,
      ),
      confirmLabel: `Apply ${preview.changes}`,
      action: () => applyImportAction(preview.id),
      onSuccess: () => {
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
      },
    });
  }

  const shown = preview?.rows.filter((r) => r.error || r.instructor || r.coach) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/admin/assignments/export" download className={buttonVariants({ variant: "outline" })}>
          Download current assignments
        </a>
        <a href="/api/admin/assignments/template" download className={buttonVariants({ variant: "outline" })}>
          Download blank template
        </a>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Easiest way: download the current assignments, change only the cells you need, and upload the file here.
      </p>
      <form action={check} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          required
          className="text-sm file:mr-3 file:h-9 file:rounded-lg file:border file:border-input file:bg-card file:px-3 file:text-sm file:font-semibold hover:file:bg-muted"
          onChange={() => setPreview(null)}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending && !preview ? "Checking…" : "Check file"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Columns: <b>NIAT ID</b>, and <b>Instructor</b> and/or <b>Coach</b> (email, instructor code such as INS012, or full name). Blank cells are left as
        they are; &quot;none&quot; removes the person. Nothing changes until you apply.
      </p>
      {preview ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <b>{preview.fileName}</b> · {preview.changes} to change · {preview.unchanged} already so · {preview.errors ? <b className="text-warning">{preview.errors} with problems (skipped)</b> : "no problems"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={pending || preview.changes === 0}>
                {`Apply ${preview.changes} change${preview.changes === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
          {shown.length ? (
            <div className="max-h-80 overflow-auto rounded-lg border border-border bg-card">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 bg-surface-subtle text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2">Row</th>
                    <th scope="col" className="px-3 py-2">Student</th>
                    <th scope="col" className="px-3 py-2">Instructor</th>
                    <th scope="col" className="px-3 py-2">Coach</th>
                    <th scope="col" className="px-3 py-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, 300).map((r) => (
                    <tr key={r.line} className="border-t border-muted">
                      <td className="px-3 py-1.5 tabular text-muted-foreground">{r.line}</td>
                      <td className="px-3 py-1.5">
                        {r.student ?? "—"} <span className="text-xs text-muted-foreground tabular">{r.niatId}</span>
                      </td>
                      <td className="px-3 py-1.5">{r.instructor ? `${r.instructor.from} → ${r.instructor.to ?? "none"}` : "—"}</td>
                      <td className="px-3 py-1.5">{r.coach ? `${r.coach.from} → ${r.coach.to ?? "none"}` : "—"}</td>
                      <td className="px-3 py-1.5 text-warning">{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
