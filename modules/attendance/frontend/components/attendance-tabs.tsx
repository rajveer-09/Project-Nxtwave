/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/common/lib/utils";

const TABS = [
  { href: "/attendance", label: "Mark hall" },
  { href: "/attendance/calendar", label: "Calendar" },
  { href: "/attendance/terms", label: "Terms" },
  { href: "/attendance/internships", label: "Internships" },
];

export function AttendanceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Attendance sections" className="flex flex-wrap gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AttendanceTabsFallback() {
  return <div className="h-11 border-b border-border" aria-hidden="true" />;
}
