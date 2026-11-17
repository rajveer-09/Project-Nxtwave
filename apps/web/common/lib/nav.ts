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
  | "analytics";

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

const EVERYONE: readonly Role[] = ["owner", "admin", "senior_instructor", "instructor"];
const ADMINS: readonly Role[] = ["owner", "admin"];

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
    label: "Admin",
    items: [
      { href: "/admin/curriculum", label: "Curriculum", icon: "curriculum", roles: ADMINS },
      { href: "/admin/messages", label: "Messages", icon: "messages", roles: ADMINS },
      { href: "/admin/staff", label: "Staff & roles", icon: "staff", roles: ADMINS },
      { href: "/analytics", label: "Analytics", icon: "analytics", roles: ADMINS },
    ],
  },
];

export function navForRole(role: Role): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
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
