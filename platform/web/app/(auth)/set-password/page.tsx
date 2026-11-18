/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { ThemeToggle } from "@/common/components/theme";
import { Skeleton } from "@/common/ui/skeleton";
import { getOptionalSessionUser } from "@/common/auth/session";
import { SetPasswordForm } from "@/modules/login/sign-in-forms";

export const metadata = { title: "Choose your password" };

/** Staff choose their own password; required after the first sign-in with the default password. */
async function Content() {
  const user = await getOptionalSessionUser();
  if (!user) redirect("/login");
  const firstTime = !!user.mustSetPassword;
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-2xl border border-border bg-card px-7 py-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] font-semibold tracking-tight">{firstTime ? "Choose your password" : "Change your password"}</h1>
        <p className="text-sm text-muted-foreground">
          {firstTime
            ? `Welcome to NxtOne, ${user.name.split(" ")[0]}. Before you start, choose a password only you know. You'll use it from now on.`
            : "Other devices will be signed out."}
        </p>
      </div>
      <SetPasswordForm firstTime={firstTime} />
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-8 bg-background px-5 py-12">
      <ThemeToggle compact className="absolute top-5 right-5" />
      <Brand size="md" />
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-[420px] rounded-2xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}
