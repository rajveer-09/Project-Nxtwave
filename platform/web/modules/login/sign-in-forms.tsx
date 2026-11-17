/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Button } from "@/common/ui/button";
import { ROLE_LABEL, ROLES } from "@/common/auth/roles";
import { devSignIn, passwordSignIn, type SignInState } from "@/modules/login/actions";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this environment yet.",
  google_no_account: "That Google account doesn't have NxtOne access yet. Ask your admin to add you.",
  google_wrong_domain: "Use your NxtWave work Google account.",
  google_email_not_verified: "Google hasn't verified that email address.",
  google_state: "The sign-in took too long or was opened in another tab. Please try again.",
};

/** Error passed back from the Google callback (?error=…). Reads the URL, so it sits in Suspense. */
export function GoogleError() {
  const code = useSearchParams().get("error");
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
      {GOOGLE_ERRORS[code] ?? "Google sign-in didn't complete. Please try again."}
    </p>
  );
}

const inputClass =
  "h-12 rounded-xl border border-input bg-card px-3 text-[15px] text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60";

/** Carries ?next= (set by proxy.ts) into the form so sign-in returns to the page that was asked for. */
function NextField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

export function PasswordForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(passwordSignIn, { error: null, email: "" });
  return (
    <form action={action} className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <NextField />
      </Suspense>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Email or NIAT ID
        <input
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          placeholder="name@nxtwave.com or N24H01A0001"
          disabled={!enabled}
          className={inputClass}
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
        {pending ? "Signing in…" : "Continue"}
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

