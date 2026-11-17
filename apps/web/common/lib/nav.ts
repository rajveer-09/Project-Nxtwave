/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import type { Role } from "@/common/auth/roles";

export type NavIcon =
  | "home"
  | "students"
  | "attendance"
  | "interactions"
  | "tests"
  | "contests"
  | "curriculum"
  | "messages"
  | "staff"
  | "analytics"
  | "assignments"
  | "changelog"
  | "shield";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  roles: readonly Role[];
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

const EVERYONE: readonly Role[] = ["owner", "admin", "senior_instructor", "instructor", "success_coach"];
/** Admin panel (admins) and Senior SDI panel (senior instructors). */
const PANEL: readonly Role[] = ["owner", "admin", "senior_instructor"];
const ADMINS: readonly Role[] = ["owner", "admin"];
const SUPER_ADMIN: readonly Role[] = ["owner"];

/** Single source for the sidebar and for route access checks. */
export const NAV: NavSection[] = [
  {
    items: [
      { href: "/", label: "Home", icon: "home", roles: EVERYONE },
      { href: "/students", label: "Students", icon: "students", roles: EVERYONE },
      { href: "/attendance", label: "Attendance", icon: "attendance", roles: EVERYONE },
      { href: "/interactions", label: "Interactions", icon: "interactions", roles: EVERYONE },
      { href: "/tests", label: "Weekly tests", icon: "tests", roles: EVERYONE },
      { href: "/contests", label: "Contests", icon: "contests", roles: EVERYONE },
    ],
  },
  {
    label: "Admin panel",
    items: [
      { href: "/admin/assignments", label: "Assignments", icon: "assignments", roles: PANEL },
      { href: "/admin/staff", label: "Staff & roles", icon: "staff", roles: PANEL },
      { href: "/admin/change-log", label: "Change log", icon: "changelog", roles: ADMINS },
      { href: "/admin/curriculum", label: "Curriculum", icon: "curriculum", roles: ADMINS },
      { href: "/admin/messages", label: "Messages", icon: "messages", roles: ADMINS },
      { href: "/analytics", label: "Analytics", icon: "analytics", roles: ADMINS },
    ],
  },
  {
    label: "Super admin",
    items: [{ href: "/superadmin", label: "Super admins", icon: "shield", roles: SUPER_ADMIN }],
  },
];

/** Labels that depend on who is looking. */
function labelFor(item: NavItem, role: Role) {
  if (item.href === "/students" && (role === "instructor" || role === "success_coach")) return "My students";
  if (item.href === "/admin/staff" && role === "senior_instructor") return "My team";
  return item.label;
}

export function navForRole(role: Role): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    label: section.label === "Admin panel" && role === "senior_instructor" ? "Senior SDI panel" : section.label,
    items: section.items.filter((item) => item.roles.includes(role)).map((item) => ({ ...item, label: labelFor(item, role) })),
  })).filter((section) => section.items.length > 0);
}

/** Longest matching nav entry for a path, used for route guards. */
export function navItemForPath(pathname: string): NavItem | undefined {
  const all = NAV.flatMap((section) => section.items);
  return all
    .filter((item) => (item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function canAccess(role: Role, pathname: string): boolean {
  const item = navItemForPath(pathname);
  return item ? item.roles.includes(role) : true;
}
