/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import type { Role } from "@/common/auth/roles";

/**
 * Who a message goes to. Shared by the compose screen (live recipient count) and
 * the server (the actual recipients), so the two always agree.
 */
export type Audience =
  | { mode: "roles"; roles: Role[]; college: string | null; hall: string | null }
  | { mode: "people"; ids: string[] };

export type DirectoryEntry = { id: string; name: string; role: Role; active: boolean; colleges: string[]; halls: string[] };

const TEACHING: Role[] = ["instructor", "senior_instructor"];

/**
 * Active staff matching the audience, never including the sender.
 * College / hall filters narrow instructors to those teaching there; owners and
 * admins aren't tied to a college or hall, so they're included when their role is picked.
 */
export function resolveAudience(audience: Audience, directory: DirectoryEntry[], senderId: string): DirectoryEntry[] {
  const active = directory.filter((s) => s.active && s.id !== senderId);
  if (audience.mode === "people") return active.filter((s) => audience.ids.includes(s.id));
  return active.filter((s) => {
    if (!audience.roles.includes(s.role)) return false;
    if (!TEACHING.includes(s.role)) return true;
    if (audience.college && !s.colleges.includes(audience.college)) return false;
    if (audience.hall && !s.halls.includes(audience.hall)) return false;
    return true;
  });
}

export const ROLE_PLURAL: Record<Role, string> = {
  owner: "Owners",
  admin: "Admins",
  senior_instructor: "Senior instructors",
  instructor: "Instructors",
};

export function describeAudience(audience: Audience, directory: DirectoryEntry[]): string {
  if (audience.mode === "people") {
    const names = directory.filter((s) => audience.ids.includes(s.id)).map((s) => s.name);
    return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  }
  const where = [audience.college, audience.hall].filter(Boolean).join(" · ");
  return `${audience.roles.map((r) => ROLE_PLURAL[r]).join(", ")}${where ? ` · ${where}` : ""}`;
}

export const PRIORITIES = ["normal", "important", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_INFO: Record<Priority, { label: string; hint: string }> = {
  normal: { label: "Normal", hint: "In-app notification" },
  important: { label: "Important", hint: "Highlighted in the inbox" },
  urgent: { label: "Urgent", hint: "Banner on every page until read" },
};
