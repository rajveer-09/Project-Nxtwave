/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { Button } from "@/common/ui/button";
import { ROLE_LABEL, ROLES } from "@/common/auth/roles";
import { cn } from "@/common/lib/utils";
import { devSignIn, passwordSignIn, setOwnPassword, type SetPasswordState, type SignInState } from "@/modules/login/actions";

const inputClass =
  "h-12 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

const MIN_LENGTH = 10; // MIN_PASSWORD_LENGTH in common/auth/core/password.ts

/** Carries ?next= (set by proxy.ts) into the form so sign-in returns to the page that was asked for. */
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

const KINDS = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
] as const;

/** Student or Staff, then the matching sign-in field. Staff covers instructors, coaches and admins. */
export function PasswordForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(passwordSignIn, { error: null, email: "", kind: "student" });
  const [kind, setKind] = useState<"student" | "staff">(state.kind);
  const student = kind === "student";
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="I am" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              kind === k.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="kind" value={kind} />
        <Suspense fallback={null}>
          <NextField />
        </Suspense>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          {student ? "NIAT ID" : "Work email"}
          <input
            key={kind}
            name="email"
            type={student ? "text" : "email"}
            inputMode={student ? "text" : "email"}
            autoComplete="username"
            autoCapitalize={student ? "characters" : "none"}
            spellCheck={false}
            required
            defaultValue={state.kind === kind ? state.email : ""}
            placeholder={student ? "N24H01A0031" : "name@nxtwave.co.in"}
            disabled={!enabled}
            className={cn(inputClass, student && "uppercase tabular placeholder:normal-case")}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required disabled={!enabled} className={inputClass} />
        </label>
        {state.error ? (
          <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-1 h-12 rounded-xl text-[15px] font-semibold" disabled={!enabled || pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-[13px] text-muted-foreground">
          First time signing in? Use the default password you were given. You&apos;ll choose your own next.
        </p>
      </form>
    </div>
  );
}

/** Staff choose their own password (first sign-in: no current password asked). */
export function SetPasswordForm({ firstTime }: { firstTime: boolean }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(setOwnPassword, { error: null });
  return (
    <form action={action} className="flex flex-col gap-4">
      {firstTime ? null : (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Current password
          <input name="current" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        New password
        <input name="next" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} className={inputClass} />
        <span className="text-xs font-normal text-muted-foreground">At least {MIN_LENGTH} characters, not based on the default password.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        New password again
        <input name="confirm" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} className={inputClass} />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-1 h-12 rounded-xl text-[15px] font-semibold" disabled={pending}>
        {pending ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  );
}

export function DevRolePicker() {
  return (
    <form action={devSignIn} className="flex flex-col gap-3 rounded-xl border border-dashed border-input bg-card p-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Development: sign in as
        <select name="role" defaultValue="owner" className={inputClass}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="lg" className="h-11 text-[15px] font-semibold">
        Continue
      </Button>
      <p className="text-xs text-muted-foreground">No database is connected, so this picks a role for reviewing menus.</p>
    </form>
  );
}
