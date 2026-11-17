/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useState } from "react";
import { useConfirm } from "@/common/components/confirm";
import { ROLE_LABEL, type Role } from "@/common/auth/roles";
import { Button } from "@/common/ui/button";
import { addStaffAction } from "@/modules/admin/actions";

const input =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

/** Add a person; the confirmation shows exactly what will be created. */
export function AddStaffForm({ roles }: { roles: Role[] }) {
  const { ask, dialog } = useConfirm();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles.includes("instructor") ? "instructor" : roles[0]);
  const [password, setPassword] = useState("");
  return (
    <form
      aria-label="Add a person"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        ask({
          title: `Add ${name.trim() || "this person"}?`,
          changes: [
            { label: "Name", after: name.trim() },
            { label: "Email", after: email.trim().toLowerCase() },
            { label: "NxtOne role", after: ROLE_LABEL[role] },
            { label: "Sign-in", after: password ? "Password you set (they can change it) or Google" : "Google only" },
          ],
          confirmLabel: "Add person",
          action: () => addStaffAction({ name, email, role, password }),
          onSuccess: () => {
            setName("");
            setEmail("");
            setPassword("");
          },
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Full name
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-52`} required minLength={2} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Work email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} w-64`} required autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={`${input} pr-8`}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        First password (optional)
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${input} w-48`}
          minLength={10}
          autoComplete="new-password"
          placeholder="Blank = Google only"
        />
      </label>
      <Button type="submit">Add person</Button>
      {dialog}
    </form>
  );
}
