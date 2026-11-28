/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { connection } from "next/server";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { ThemeToggle } from "@/common/components/theme";
import { authMode, devSessionAllowed } from "@/common/auth/config";
import { DevRolePicker, PasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Sign in" };


/**
 * The form reads the server's settings when the page is opened, not when it is built: a build
 * without settings (e.g. a Docker image) would otherwise ship the form switched off for good.
 */
async function SignInForm() {
  await connection();
  return (
    <>
      <PasswordForm enabled={authMode() === "database"} />
      {devSessionAllowed() ? <DevRolePicker /> : null}
    </>
  );
}

/**
 * Landing + sign-in. A Student / Staff choice, then NIAT ID or work email and password. First-time
 * sign-ins use the default first password and choose their own next. Static apart from the form.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-app flex-col bg-background lg:flex-row">
      {/* ---- Left: what NxtOne is */}
      <section
        aria-label="About NxtOne"
        className="relative flex flex-col justify-between gap-10 overflow-hidden bg-[#070B12] px-6 py-8 text-white sm:px-12 lg:flex-[1.15] lg:px-16 lg:py-14"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_10%,rgba(0,110,198,0.22),transparent_70%),radial-gradient(60%_50%_at_90%_100%,rgba(0,110,198,0.14),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
        />
        <Brand size="lg" onDark className="relative" />
        <div className="relative flex max-w-[600px] flex-col gap-6 lg:gap-7">
          <h1 className="text-[36px] leading-[1.06] font-semibold tracking-tight text-balance sm:text-[50px] xl:text-[58px]">
            One place for every learner&apos;s journey.
          </h1>
          <p className="max-w-[46ch] text-[16px] leading-relaxed text-white/70 sm:text-[18px]">
            NxtOne brings each student&apos;s DSA learning together for students, instructors, coaches and teams across NIAT.
          </p>
        </div>
        <p className="relative hidden text-xs text-white/50 lg:block">© 2026 NxtWave. All rights reserved.</p>
      </section>

      {/* ---- Right: sign in */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <ThemeToggle compact className="absolute top-5 right-5" />
        <div className="flex w-full max-w-[420px] flex-col gap-8">
          <h2 className="text-[32px] leading-tight font-semibold tracking-tight sm:text-[36px]">Sign in</h2>

          <Suspense fallback={<PasswordForm enabled={false} />}>
            <SignInForm />
          </Suspense>

        </div>
      </main>
    </div>
  );
}
