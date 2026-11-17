/*

Author : Rajveer Sharma
Date : 18 Nov 2026
@ Nxtwave

*/

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/common/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/ui/dialog";
import { cn } from "@/common/lib/utils";

/**
 * Every change in the admin screens goes through this: a centred pop-up that previews exactly what
 * will change (before → after, or the people affected) and only saves after "Confirm".
 *
 *   const { ask, dialog } = useConfirm();
 *   ask({ title, changes: [{ label, before, after }], confirmLabel, action: () => someServerAction() });
 *   return <>{…}{dialog}</>;
 */

export type Change = { label: string; before?: string | null; after?: string | null };
type Outcome = { ok: true; message?: string } | { ok: false; error: string };

export type ConfirmOptions<R extends Outcome = Outcome> = {
  title: string;
  description?: string;
  changes?: Change[];
  /** People or students affected, when it's a list rather than before → after. */
  items?: string[];
  confirmLabel: string;
  /** Deletions and anything hard to undo get a red button. */
  danger?: boolean;
  action: () => Promise<R>;
  /** Runs after a successful save (e.g. to download a file or clear a selection). */
  onSuccess?: (result: Extract<R, { ok: true }>) => void;
  /** Runs when the person cancels (e.g. to put a dropdown back). */
  onCancel?: () => void;
};

const MAX_ITEMS = 8;

export function useConfirm() {
  const router = useRouter();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [pending, startTransition] = useTransition();

  function close(cancelled: boolean) {
    if (pending) return;
    if (cancelled) options?.onCancel?.();
    setOptions(null);
  }

  function confirm() {
    if (!options) return;
    const current = options;
    startTransition(async () => {
      const result = await current.action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      current.onSuccess?.(result as never);
      setOptions(null);
      router.refresh();
    });
  }

  const dialog = (
    <Dialog open={!!options} onOpenChange={(open) => !open && close(true)}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg" showCloseButton={!pending}>
        {options ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{options.title}</DialogTitle>
              {options.description ? <DialogDescription className="text-[13px]">{options.description}</DialogDescription> : null}
            </DialogHeader>
            {options.changes?.length ? (
              <dl className="flex flex-col overflow-hidden rounded-xl border border-border">
                {options.changes.map((c) => (
                  <div key={c.label} className="grid grid-cols-[110px_1fr] items-baseline gap-3 border-b border-muted px-3.5 py-2.5 text-[13px] last:border-b-0">
                    <dt className="text-xs font-semibold text-muted-foreground">{c.label}</dt>
                    <dd className="flex flex-wrap items-baseline gap-x-2">
                      {c.before !== undefined ? (
                        <>
                          <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.before ?? "none"}</span>
                          <span aria-label="changes to" className="text-muted-foreground">→</span>
                        </>
                      ) : null}
                      <span className="font-semibold">{c.after ?? "none"}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {options.items?.length ? (
              <div className="rounded-xl border border-border px-3.5 py-2.5">
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  {options.items.length} {options.items.length === 1 ? "item" : "items"}
                </p>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {options.items.slice(0, MAX_ITEMS).map((item) => (
                    <li key={item} className="truncate">
                      {item}
                    </li>
                  ))}
                  {options.items.length > MAX_ITEMS ? <li className="text-muted-foreground">and {options.items.length - MAX_ITEMS} more</li> : null}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => close(true)} disabled={pending}>
                Cancel
              </Button>
              <Button
                onClick={confirm}
                disabled={pending}
                className={cn(options.danger && "bg-[#C42B1C] text-white hover:bg-[#A82315]")}
                autoFocus
              >
                {pending ? "Saving…" : options.confirmLabel}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  return { ask: <R extends Outcome>(o: ConfirmOptions<R>) => setOptions(o as unknown as ConfirmOptions), dialog, pending };
}
