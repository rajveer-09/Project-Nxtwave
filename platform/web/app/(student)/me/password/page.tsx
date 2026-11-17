/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { Suspense } from "react";
import { Skeleton } from "@/common/ui/skeleton";
import { requireStudent } from "@/common/auth/student/session";
import { PasswordForm } from "@/modules/student/password-form";

export const metadata = { title: "Choose your password" };

async function Content() {
  const student = await requireStudent();
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border border-border bg-card px-7 py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] font-semibold tracking-tight">{student.mustChangePassword ? "Choose your password" : "Change your password"}</h1>
        <p className="text-sm text-muted-foreground">
          {student.mustChangePassword
            ? "You signed in with a password your instructor gave you. Choose your own to continue."
            : "Other devices will be signed out."}
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}

export default function PasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-[420px] rounded-2xl" />}>
      <Content />
    </Suspense>
  );
}
