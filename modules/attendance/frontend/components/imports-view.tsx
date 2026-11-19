/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/common/components/page-header";
import { cn } from "@/common/lib/utils";
import { ImportAttendance } from "./import-attendance";
import { ImportCalendar } from "./import-calendar";
import { ImportStudents } from "./import-students";

type Tab = "students" | "attendance" | "calendar";
const TABS: { id: Tab; label: string }[] = [
  { id: "students", label: "Import students" },
  { id: "attendance", label: "Import attendance" },
  { id: "calendar", label: "Import calendar" },
];

/** Attendance imports in the Admin panel. All three cards stay mounted, so switching tabs keeps an open preview. */
export function ImportsView() {
  const params = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "attendance" || initial === "calendar" ? initial : "students");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow="Admin panel" title="Attendance imports" description="Upload a .xlsx or .csv sheet, check the preview, then confirm. Nothing is saved before you confirm." />
      <div className="inline-flex self-start rounded-lg bg-muted p-0.5" role="tablist" aria-label="Import type">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`import-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`import-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn("h-9 rounded-md px-3.5 text-[13px] font-semibold transition-colors", tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="import-panel-students" aria-labelledby="import-tab-students" hidden={tab !== "students"}>
        <ImportStudents />
      </div>
      <div role="tabpanel" id="import-panel-attendance" aria-labelledby="import-tab-attendance" hidden={tab !== "attendance"}>
        <ImportAttendance />
      </div>
      <div role="tabpanel" id="import-panel-calendar" aria-labelledby="import-tab-calendar" hidden={tab !== "calendar"}>
        <ImportCalendar />
      </div>
    </div>
  );
}
