/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import { CalendarCheck, MessageCircle, Trophy } from "lucide-react";
import { Suspense } from "react";
import { authMode, devSessionAllowed, googleConfigured } from "@/common/auth/config";
import { DevRolePicker, GoogleError, PasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Sign in" };

const MODULES = [
  { icon: CalendarCheck, title: "Attendance", text: "Mark halls daily, track terms, internships and 75% risk." },
  { icon: MessageCircle, title: "Interactions", text: "Log sessions, move DSA levels, see who is overdue." },
  { icon: Trophy, title: "Contests", text: "Weekly and biweekly results, ratings and topic gaps." },
];

export default function LoginPage() {
  const database = authMode() === "database";
  const google = database && googleConfigured();
  return (
    <div className="flex min-h-dvh flex-wrap bg-background">
      <section
        aria-label="About"
        className="flex flex-[1_1_420px] flex-col justify-between gap-12 bg-foreground px-8 py-14 text-background sm:px-16"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary font-heading text-lg font-bold text-primary-foreground">
            N
          </span>
          <span className="font-heading text-lg font-semibold">NxtWave Student Hub</span>
        </div>
        <div className="flex max-w-lg flex-col gap-7">
          <h1 className="text-[44px] leading-[1.1] font-semibold">Every student, in one place.</h1>
          <p className="text-base text-[#C4C8D2]">
            Attendance, instructor interactions, weekly tests and LeetCode contests share one roster and one login.
          </p>
          <ul className="flex flex-col gap-4">
            {MODULES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[#262A33] text-[#AFC0F5]">
                  <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.8} />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{title}</span>
                  <span className="text-[13px] text-[#AEB3BF]">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <span className="text-xs text-[#8E94A3]">Internal tool · NxtWave staff only</span>
      </section>

      <main className="flex flex-[1_1_480px] items-center justify-center px-8 py-14">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-semibold">Sign in</h2>
            <p className="text-muted-foreground">Use your NxtWave work account.</p>
          </div>

          <Suspense fallback={null}>
            <GoogleError />
          </Suspense>

          {google ? (
            <a
              href="/api/auth/google/login"
              className="flex h-12 items-center justify-center gap-2.5 rounded-lg border border-input bg-card text-[15px] font-semibold text-foreground hover:bg-muted"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
              </svg>
              Continue with Google
            </a>
          ) : (
            <p className="rounded-lg border border-dashed border-input px-3 py-2.5 text-xs text-muted-foreground">
              Google sign-in appears here once GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_BASE_URL are set.
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or use a password
            <span className="h-px flex-1 bg-border" />
          </div>

          <PasswordForm enabled={database} />

          {devSessionAllowed() ? <DevRolePicker /> : null}
        </div>
      </main>
    </div>
  );
}
