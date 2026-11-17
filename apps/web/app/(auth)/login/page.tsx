/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { authMode, devSessionAllowed, googleConfigured } from "@/common/auth/config";
import { DevRolePicker, GoogleError, PasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Sign in" };

function GoogleButton() {
  return (
    <a
      href="/api/auth/google/login"
      className="flex h-12 items-center justify-center gap-3 rounded-xl border border-input bg-card text-[15px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
      Continue with Google
    </a>
  );
}

/**
 * Sign-in: the NxtOne lockup, one card, Google first and a password as the fallback.
 * Static apart from the forms, so it opens instantly.
 */
export default function LoginPage() {
  const database = authMode() === "database";
  const google = database && googleConfigured();
  const development = process.env.NODE_ENV !== "production";
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#F6F8FB] px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(0,110,198,0.10),rgba(0,110,198,0)_70%)]"
      />
      <main className="relative flex w-full max-w-[400px] flex-col items-center">
        <Brand size="lg" className="mb-9" />
        <div className="w-full rounded-2xl border border-[#E4E8EF] bg-card px-7 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_40px_-16px_rgba(16,24,40,0.16)] sm:px-9">
          <h1 className="text-center text-[26px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">Use your NxtWave account to continue.</p>

          <div className="mt-7 flex flex-col gap-5">
            <Suspense fallback={null}>
              <GoogleError />
            </Suspense>

            {google ? (
              <>
                <GoogleButton />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            ) : development ? (
              <p className="rounded-lg border border-dashed border-input px-3 py-2.5 text-xs text-muted-foreground">
                Development: Google sign-in appears once GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_BASE_URL are set.
              </p>
            ) : null}

            <PasswordForm enabled={database} />

            {devSessionAllowed() ? <DevRolePicker /> : null}
          </div>
        </div>
        <footer className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          <span>Trouble signing in? Ask your admin.</span>
          <span>© {2026} NxtWave</span>
        </footer>
      </main>
    </div>
  );
}
