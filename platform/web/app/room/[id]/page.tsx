/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Brand } from "@/common/components/brand";
import { Skeleton } from "@/common/ui/skeleton";
import { CodeRoom } from "@nxtone/interactions-ui/room/components/code-room";
import { loadRoom, roomAccess, roomsAvailable } from "@nxtone/interactions-ui/room/data";

export const metadata = { title: "Code room" };

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-5">
      <Brand size="md" />
      <div className="flex max-w-md flex-col gap-2 rounded-2xl border border-border bg-card px-6 py-6 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** The live code room. Staff, or the student it was opened for, signed in. */
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!roomsAvailable()) return <Message title="Code rooms need the database">Connect the database to use code rooms.</Message>;
  const room = await loadRoom(id);
  if (!room) notFound();
  const access = await roomAccess(room.niatId);
  if (!access.ok) {
    if (access.reason === "signed-out") redirect(`/login?next=${encodeURIComponent(`/room/${id}`)}`);
    if (access.reason === "set-password") redirect("/set-password");
    if (access.reason === "change-password") redirect("/me/password");
    return (
      <Message title="This room isn't yours">
        It was opened for another student. Sign in with your own NIAT ID, or ask your instructor for your link.{" "}
        <Link href="/me" className="font-semibold text-primary">
          Go to your page
        </Link>
      </Message>
    );
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return <CodeRoom initial={room} viewer={access.viewer} shareUrl={`${proto}://${host}/room/${room.id}`} />;
}

export default function RoomPage({ params }: PageProps<"/room/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-col gap-4 bg-background p-6" aria-busy="true" aria-label="Opening the room">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-[70vh] rounded-xl" />
        </div>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
