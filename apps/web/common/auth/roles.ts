/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

/**
 * Platform roles (ARCHITECTURE.md §6). Module-level roles live in core.staff_roles;
 * the UI only needs the platform role to decide menus and route access.
 */
export const ROLES = ["owner", "admin", "senior_instructor", "instructor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  senior_instructor: "Senior instructor",
  instructor: "Instructor",
};

export function isRole(value: string | undefined | null): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}

export function isAdminRole(role: Role) {
  return role === "owner" || role === "admin";
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
