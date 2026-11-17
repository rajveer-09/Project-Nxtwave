/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWeeklyTest, unlockTestResults } from "@/modules/tests/actions";
import { Button } from "@/common/ui/button";
import { BANDS, type Band } from "@/modules/tests/types";

const input =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function NewTestForm({ formats, suggestedName, today }: { formats: { id: string; name: string; version: number }[]; suggestedName: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestedName);
  const [bands, setBands] = useState<Band[]>([...BANDS]);
  const [heldOn, setHeldOn] = useState(today);
  const [dueAt, setDueAt] = useState(`${today}T18:00`);
  const [formatId, setFormatId] = useState(formats[0]?.id ?? "");

  function create() {
    startTransition(async () => {
      const messages: string[] = [];
      for (const band of bands) {
        const result = await createWeeklyTest({ name, band, heldOn, dueAt, formatId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        messages.push(band);
      }
      toast.success(`${name} created for ${messages.join(", ")}. Instructors can enter results now.`);
      router.refresh();
    });
  }

  return (
    <form
      aria-label="Create a weekly test"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="text-base font-semibold">Create a weekly test</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-44`} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Held on
          <input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} className={input} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Results due
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={input} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Result format
          <select value={formatId} onChange={(e) => setFormatId(e.target.value)} className={input}>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · v{f.version}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Level bands (one test per band)</legend>
        {BANDS.map((b) => (
          <label key={b} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm">
            <input type="checkbox" checked={bands.includes(b)} onChange={() => setBands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))} className="size-4 accent-primary" />
            {b}
          </label>
        ))}
        <Button type="submit" className="ml-auto h-10" disabled={pending || !bands.length || !name.trim()}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </fieldset>
    </form>
  );
}

export function UnlockButton({ testId, instructor }: { testId: string; instructor: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-9"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (!window.confirm(`Unlock ${instructor}'s results so they can edit them again?`)) return;
          const result = await unlockTestResults(testId, instructor);
          if (result.ok) toast.success(`Unlocked for ${instructor}.`);
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      Unlock
    </Button>
  );
}
