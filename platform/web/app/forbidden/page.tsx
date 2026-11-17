/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/common/components/empty-state";

export const metadata = { title: "No access" };

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-app max-w-lg flex-col justify-center px-4">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description="Your role doesn't include this section. Ask an Owner to update your access under Admin › Staff & roles."
        action={
          <Link href="/" className="font-semibold text-primary hover:text-accent-strong">
            Back to Home
          </Link>
        }
      />
    </main>
  );
}
