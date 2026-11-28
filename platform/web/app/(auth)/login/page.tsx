/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { ChartNoAxesCombined, ShieldCheck, Sparkles } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { ThemeToggle } from "@/common/components/theme";
import { authMode, devSessionAllowed } from "@/common/auth/config";
import { DevRolePicker, PasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Sign in" };

const POINTS = [
  { icon: ChartNoAxesCombined, title: "Every learner, one view", text: "DSA attendance, progress, feedback and contests together, always up to date." },
  { icon: Sparkles, title: "Made for every role", text: "Students see their own journey. Instructors, coaches and admins see what they need." },
  { icon: ShieldCheck, title: "Every change on record", text: "Who changed what, and when, is kept for the people who need to know." },
];

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
        <div className="relative flex max-w-xl flex-col gap-6">
          <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight sm:text-[46px]">One place for every learner&apos;s journey.</h1>
          <p className="max-w-lg text-[17px] leading-relaxed text-white/75">
            NxtOne brings each student&apos;s learning together for students, instructors, coaches and teams across NxtWave.
          </p>
          <ul className="mt-2 hidden flex-col gap-5 sm:flex">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
                  <Icon aria-hidden="true" className="size-5 text-[#8CC8FF]" strokeWidth={1.8} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden text-xs text-white/50 lg:block">© 2026 NxtWave. All rights reserved.</p>
      </section>

      {/* ---- Right: sign in */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <ThemeToggle compact className="absolute top-5 right-5" />
        <div className="flex w-full max-w-[400px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-semibold tracking-tight">Sign in</h2>
            <p className="text-[15px] text-muted-foreground">Students sign in with their NIAT ID, staff with their work email.</p>
          </div>

          <Suspense fallback={<PasswordForm enabled={false} />}>
            <SignInForm />
          </Suspense>

          <p className="text-center text-xs text-muted-foreground">Trouble signing in? Staff: ask your admin. Students: ask your instructor.</p>
        </div>
      </main>
    </div>
  );
}
