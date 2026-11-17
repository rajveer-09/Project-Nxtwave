/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useActionState } from "react";
import { Button } from "@/common/ui/button";
import { changeOwnPassword, type PasswordState } from "@/modules/student/actions";

const MIN_LENGTH = 10; // same as MIN_PASSWORD_LENGTH in common/auth/core/password.ts
const input =
  "h-12 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changeOwnPassword, { error: null, done: false });
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Current password
        <input name="current" type="password" autoComplete="current-password" required className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        New password
        <input name="next" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} className={input} />
        <span className="text-xs font-normal text-muted-foreground">At least {MIN_LENGTH} characters.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        New password again
        <input name="confirm" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} className={input} />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="mt-1 h-12 rounded-xl text-[15px] font-semibold" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
