/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

/**
 * Platform roles. Module-level roles live in core.staff_roles; the UI only needs the
 * platform role to decide menus, panels and route access.
 *
 *   owner              Super admin: Superadmin panel, everything; set in the database only
 *   admin              Admin (managers): Admin panel; can add and edit admins, never super admins
 *   senior_instructor  Senior SDI: Senior SDI panel; never sees admins or super admins
 *   instructor         My students only, no panel
 *   success_coach      My students (the students they coach) only, no panel
 *
 * "owner" stays the stored name so the identity tokens the services already check keep working.
 */
export const ROLES = ["owner", "admin", "senior_instructor", "instructor", "success_coach"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Super admin",
  admin: "Admin",
  senior_instructor: "Senior instructor",
  instructor: "Instructor",
  success_coach: "Success coach",
};

/** Higher sees and manages lower. Instructors and success coaches are peers. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 50,
  admin: 40,
  senior_instructor: 30,
  instructor: 20,
  success_coach: 20,
};

/** Roles this person may see in staff lists and the directory. */
export function visibleRoles(viewer: Role): Role[] {
  if (viewer === "owner") return [...ROLES];
  if (viewer === "admin") return ROLES.filter((r) => r !== "owner");
  return ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[viewer]);
}

/**
 * Roles this person may give someone (and whose holders they may edit). Admins can make admins.
 * Super admin is never given or taken away in NxtOne, not even by another super admin: the
 * super admins are set in the database only.
 */
export function assignableRoles(viewer: Role): Role[] {
  if (viewer === "owner" || viewer === "admin") return ROLES.filter((r) => r !== "owner");
  return [];
}

/** Instructors and success coaches have no panel; they work from My students. */
export function hasPanel(role: Role) {
  return ROLE_RANK[role] >= ROLE_RANK.senior_instructor;
}

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
