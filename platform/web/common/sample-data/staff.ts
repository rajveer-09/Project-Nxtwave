/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

/**
 * Sample staff directory until core.staff is connected. Fictional people; emails
 * use example.com. Names match the roster's instructor names and the
 * development sign-in users (common/auth/session.ts).
 */
import type { Role } from "@/common/auth/roles";
import { ROSTER } from "./roster";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** Colleges and halls of the students assigned to them (instructors only). */
  colleges: string[];
  halls: string[];
};

const BASE: Omit<StaffMember, "colleges" | "halls">[] = [
  { id: "s1", name: "Priya K.", email: "owner@example.com", role: "owner", active: true },
  { id: "s2", name: "Ravi V.", email: "admin@example.com", role: "admin", active: true },
  { id: "s3", name: "Farhan A.", email: "farhan@example.com", role: "admin", active: true },
  { id: "s4", name: "Neha P.", email: "senior@example.com", role: "senior_instructor", active: true },
  { id: "s5", name: "Karthik S.", email: "instructor@example.com", role: "instructor", active: true },
  { id: "s6", name: "Suresh M.", email: "suresh@example.com", role: "instructor", active: true },
  { id: "s7", name: "Divya R.", email: "divya@example.com", role: "instructor", active: true },
  { id: "s8", name: "Anil T.", email: "anil@example.com", role: "instructor", active: true },
  { id: "s9", name: "Meena J.", email: "meena@example.com", role: "instructor", active: true },
  { id: "s10", name: "Rakesh B.", email: "former@example.com", role: "instructor", active: false },
];

export const STAFF: StaffMember[] = BASE.map((s) => {
  const mine = ROSTER.filter((r) => r.instructor === s.name);
  return { ...s, colleges: [...new Set(mine.map((r) => r.college))].sort(), halls: [...new Set(mine.map((r) => r.hall))].sort() };
});
