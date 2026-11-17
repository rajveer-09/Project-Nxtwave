/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { ChartNoAxesCombined, ShieldCheck, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { ThemeToggle } from "@/common/components/theme";
import { authMode, devSessionAllowed, googleConfigured } from "@/common/auth/config";
import { DevRolePicker, GoogleError, PasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Sign in" };

const POINTS = [
  { icon: ChartNoAxesCombined, title: "Every learner, one view", text: "Attendance, progress, feedback and contests together, always up to date." },
  { icon: Sparkles, title: "Made for every role", text: "Students see their own journey. Instructors, coaches and admins see what they need." },
  { icon: ShieldCheck, title: "Every change on record", text: "Who changed what, and when, is kept for the people who need to know." },
];

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
 * Landing + sign-in. One form for everyone: an email signs in as staff, a NIAT ID as a student.
 * Static apart from the form, so it opens instantly.
 */
export default function LoginPage() {
  const database = authMode() === "database";
  const google = database && googleConfigured();
  const development = process.env.NODE_ENV !== "production";
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
            <p className="text-[15px] text-muted-foreground">Staff use their work email. Students use their NIAT ID.</p>
          </div>

          <Suspense fallback={null}>
            <GoogleError />
          </Suspense>

          {google ? (
            <>
              <GoogleButton />
              <div className="-my-1 flex items-center gap-3 text-xs text-muted-foreground">
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

          <p className="text-center text-xs text-muted-foreground">Trouble signing in? Staff: ask your admin. Students: ask your instructor.</p>
        </div>
      </main>
    </div>
  );
}
