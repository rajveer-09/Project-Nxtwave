/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { publishResultFormat } from "@/modules/tests/actions";
import { Button } from "@/common/ui/button";
import { FIELD_TYPE_LABEL, FIELD_TYPES, maxTotal, type FieldType, type FormatField, type FormatVersion, type ResultValue } from "@/modules/tests/types";
import { cn } from "@/common/lib/utils";
import { FieldInput } from "@/modules/tests/components/field-input";

const input =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function FormatBuilder({ formatId, name, current, usedBy }: { formatId: string; name: string; current: FormatVersion; usedBy: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<FormatField[]>(current.fields);
  const [passMark, setPassMark] = useState(current.passMark);
  const [open, setOpen] = useState<string | null>(null);
  const [draftOption, setDraftOption] = useState("");
  const [preview, setPreview] = useState<Record<string, ResultValue>>({});
  const dirty = JSON.stringify({ fields, passMark }) !== JSON.stringify({ fields: current.fields, passMark: current.passMark });
  const total = maxTotal(fields);

  const patch = (id: string, p: Partial<FormatField>) => setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const move = (i: number, d: number) =>
    setFields((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  function add(type: FieldType) {
    // Next free id (f9, f10, …); ids are stable keys for stored values.
    let n = fields.length + 1;
    while (fields.some((f) => f.id === `f${n}`)) n++;
    const id = `f${n}`;
    const field: FormatField = {
      id,
      type,
      label: `New ${FIELD_TYPE_LABEL[type].name.toLowerCase()} field`,
      help: "",
      required: false,
      column: type === "marks" || type === "number",
      ...(type === "marks" ? { max: 10 } : {}),
      ...(type === "single" || type === "multi" ? { options: ["Option 1", "Option 2"] } : {}),
    };
    setFields((prev) => [...prev, field]);
    setOpen(id);
  }
  function publish() {
    startTransition(async () => {
      const result = await publishResultFormat(formatId, { passMark, fields });
      if (result.ok) {
        toast.success(result.message ?? "Published.");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          dirty ? "border-warning-border bg-warning-soft" : "border-border bg-card",
        )}
      >
        <div className="flex flex-col">
          <span className={cn("font-bold", dirty && "text-[#6E3005]")}>
            {dirty ? `Unpublished changes · will become version ${current.version + 1}` : `${name} · version ${current.version} in use`}
          </span>
          <span className="text-[13px] text-sidebar-foreground">
            {dirty
              ? "Tests already created keep their version. Tests created after you publish use the new one."
              : `Used by ${usedBy} test${usedBy === 1 ? "" : "s"}. Published by ${current.publishedBy}.`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10"
            disabled={!dirty || pending}
            onClick={() => {
              setFields(current.fields);
              setPassMark(current.passMark);
            }}
          >
            Discard changes
          </Button>
          <Button className="h-10" disabled={!dirty || pending} onClick={publish}>
            {pending ? "Publishing…" : `Publish version ${current.version + 1}`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Fields" className="flex min-w-0 flex-[1_1_520px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-input bg-card px-4 py-3 text-[13px] text-sidebar-foreground">
            <span className="font-bold text-foreground">Always included</span>
            <span>Student · Took the test (present/absent) · Total</span>
            <label className="ml-auto flex items-center gap-2 font-semibold">
              Pass mark
              <input type="number" min={0} max={total} value={passMark} onChange={(e) => setPassMark(Number(e.target.value) || 0)} className="h-9 w-20 rounded-lg border border-input px-2 tabular" />
              <span className="font-normal text-muted-foreground">of {total}</span>
            </label>
          </div>

          {fields.map((f, i) => {
            const expanded = open === f.id;
            return (
              <div key={f.id} className={cn("overflow-hidden rounded-xl border bg-card", expanded ? "border-primary" : "border-border")}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-6 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40">
                      <ArrowUp aria-hidden="true" className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Move ${f.label} down`} disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="flex h-6 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40">
                      <ArrowDown aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>
                  <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : f.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-bold", f.type === "marks" ? "bg-accent text-accent-foreground" : "bg-muted text-sidebar-foreground")}>
                      {FIELD_TYPE_LABEL[f.type].name}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">
                        {f.label || "Untitled field"}
                        {f.required ? <span className="text-warning"> *</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {f.type === "marks" ? `Out of ${f.max ?? 0}` : f.options ? `${f.options.length} options` : FIELD_TYPE_LABEL[f.type].hint} · {f.column ? "table column" : "feedback panel"}
                      </span>
                    </span>
                  </button>
                  <button type="button" aria-label={`Delete ${f.label}`} onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {expanded ? (
                  <div className="flex flex-col gap-3 border-t border-muted bg-surface-subtle px-4 py-3.5">
                    <div className="flex flex-wrap gap-3">
                      <label className="flex flex-[2_1_220px] flex-col gap-1.5 text-[13px] font-medium">
                        Field name
                        <input value={f.label} onChange={(e) => patch(f.id, { label: e.target.value })} className={input} />
                      </label>
                      {f.type === "marks" ? (
                        <label className="flex flex-[1_1_110px] flex-col gap-1.5 text-[13px] font-medium">
                          Max marks
                          <input type="number" min={1} value={f.max ?? 0} onChange={(e) => patch(f.id, { max: Math.max(0, Number(e.target.value) || 0) })} className={input} />
                        </label>
                      ) : null}
                    </div>
                    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                      Hint for instructors (optional)
                      <input value={f.help} onChange={(e) => patch(f.id, { help: e.target.value })} className={input} />
                    </label>
                    {f.options ? (
                      <div className="flex flex-col gap-2">
                        <span className="text-[13px] font-medium">Options</span>
                        <div className="flex flex-wrap gap-1.5">
                          {f.options.map((o) => (
                            <span key={o} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-input bg-card pr-1 pl-3 text-[13px]">
                              {o}
                              <button type="button" aria-label={`Remove ${o}`} onClick={() => patch(f.id, { options: f.options!.filter((x) => x !== o) })} className="flex size-6 items-center justify-center rounded-full hover:bg-muted">
                                <X aria-hidden="true" className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input aria-label="New option" value={draftOption} onChange={(e) => setDraftOption(e.target.value)} placeholder="Add an option" className={input} />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10"
                            onClick={() => {
                              const t = draftOption.trim();
                              if (t && !f.options!.includes(t)) patch(f.id, { options: [...f.options!, t] });
                              setDraftOption("");
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-4 text-[13px]">
                      <label className="flex min-h-9 items-center gap-2">
                        <input type="checkbox" checked={f.required} onChange={() => patch(f.id, { required: !f.required })} className="size-4 accent-primary" />
                        Required before submitting
                      </label>
                      <label className="flex min-h-9 items-center gap-2">
                        <input type="checkbox" checked={f.column} onChange={() => patch(f.id, { column: !f.column })} className="size-4 accent-primary" />
                        Show as a column in the marks table
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
            <span className="font-bold">Add a field</span>
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => add(t)} className="flex min-h-11 flex-col justify-center rounded-lg border border-input px-3 text-left text-[13px] font-semibold hover:bg-muted">
                  + {FIELD_TYPE_LABEL[t].name}
                  <span className="text-[11px] font-medium text-muted-foreground">{FIELD_TYPE_LABEL[t].hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Preview" className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          <h2 className="text-lg font-semibold">Preview · what instructors see</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">Marks table preview</caption>
              <thead>
                <tr className="bg-surface-subtle text-left text-xs text-muted-foreground">
                  <th scope="col" className="border-b border-border px-3 py-2.5 whitespace-nowrap">Student</th>
                  {fields
                    .filter((f) => f.column)
                    .map((f) => (
                      <th key={f.id} scope="col" className="border-b border-border px-2 py-2.5 whitespace-nowrap">
                        {f.label}
                        {f.type === "marks" ? ` /${f.max}` : ""}
                      </th>
                    ))}
                  <th scope="col" className="border-b border-border px-3 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">Sample student</td>
                  {fields
                    .filter((f) => f.column)
                    .map((f) => (
                      <td key={f.id} className="px-2 py-2">
                        <FieldInput field={f} compact label={`Preview ${f.label}`} value={preview[f.id]} onChange={(v) => setPreview((p) => ({ ...p, [f.id]: v }))} />
                      </td>
                    ))}
                  <td className="px-3 py-2.5 font-bold whitespace-nowrap tabular">— / {total}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Feedback panel · per student</span>
            {fields
              .filter((f) => !f.column)
              .map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">
                    {f.label}
                    {f.required ? <span className="text-warning"> *</span> : null}
                  </span>
                  <FieldInput field={f} value={preview[f.id]} onChange={(v) => setPreview((p) => ({ ...p, [f.id]: v }))} />
                  {f.help ? <span className="text-xs text-muted-foreground">{f.help}</span> : null}
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
