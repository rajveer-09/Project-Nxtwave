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

/** showStudents: the Students tab, for Owners and admins only (nav.ts PAGE_RULES). */
export function AttendanceTabs({ showStudents = false }: { showStudents?: boolean }) {
  const pathname = usePathname();
  const tabs = showStudents ? [...TABS, { href: "/attendance/students", label: "Students" }] : TABS;
  return (
    <nav aria-label="DSA attendance sections" className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => {
        // Students stays highlighted on a student's own page.
        const active = pathname === tab.href || (tab.href === "/attendance/students" && pathname.startsWith(tab.href + "/"));
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
