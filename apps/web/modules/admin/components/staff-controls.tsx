/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, type Role } from "@/common/auth/roles";
import { Button } from "@/common/ui/button";
import { addStaffAction, changeRoleAction, setActiveAction, type ActionResult } from "@/modules/admin/actions";

const input =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        after?.();
        router.refresh();
      } else toast.error(result.error);
    });
  return { pending, run };
}

/** Role picker for one person. Only the roles the viewer may give are offered. */
export function RoleSelect({ staffId, name, role, roles }: { staffId: string; name: string; role: Role | null; roles: Role[] }) {
  const { pending, run } = useAction();
  return (
    <select
      aria-label={`Role for ${name}`}
      className={`${input} h-9 pr-8`}
      value={role ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Role;
        if (next && next !== role) run(() => changeRoleAction(staffId, next));
      }}
    >
      {role === null ? <option value="">No access</option> : null}
      {roles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

export function ActiveToggle({ staffId, name, active }: { staffId: string; name: string; active: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (active && !window.confirm(`Stop ${name} from signing in? They're signed out everywhere.`)) return;
        run(() => setActiveAction(staffId, !active));
      }}
    >
      {active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

export function AddStaffForm({ roles }: { roles: Role[] }) {
  const { pending, run } = useAction();
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
        run(
          () => addStaffAction({ name, email, role, password }),
          () => {
            setName("");
            setEmail("");
            setPassword("");
          },
        );
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
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add person"}
      </Button>
    </form>
  );
}
