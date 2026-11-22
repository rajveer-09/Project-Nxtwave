/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/common/ui/button";
import { Dropdown } from "@/common/components/dropdown";
import { asOptions } from "@/common/lib/options";
import { searchMatcher } from "@/common/lib/search";
import { ROLE_LABEL, ROLES, type Role } from "@/common/auth/roles";
import { cn } from "@/common/lib/utils";
import { sendMessageAction } from "../actions";
import { sentKey } from "../api";
import { PRIORITIES, PRIORITY_INFO, resolveAudience, ROLE_PLURAL, type Audience, type DirectoryEntry, type Priority } from "../audience";

const input =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function Compose({ directory, senderId, colleges, halls }: { directory: DirectoryEntry[]; senderId: string; colleges: string[]; halls: string[] }) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"roles" | "people">("roles");
  const [roles, setRoles] = useState<Role[]>(["instructor", "senior_instructor"]);
  const [college, setCollege] = useState<string | null>(null);
  const [hall, setHall] = useState<string | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [requireAck, setRequireAck] = useState(false);
  const [alsoEmail, setAlsoEmail] = useState(false);

  const audience: Audience = mode === "roles" ? { mode, roles, college, hall } : { mode, ids };
  const recipients = resolveAudience(audience, directory, senderId);
  const match = searchMatcher(q);
  const people = directory.filter((s) => s.active && s.id !== senderId && match(s.name, ROLE_LABEL[s.role]));
  const roleCount = (r: Role) => resolveAudience({ mode: "roles", roles: [r], college, hall }, directory, senderId).length;

  function send() {
    startTransition(async () => {
      const result = await sendMessageAction({ audience, subject, body, priority, requireAck, alsoEmail });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Sent.");
      setSubject("");
      setBody("");
      setPriority("normal");
      setRequireAck(false);
      await queryClient.invalidateQueries({ queryKey: sentKey });
    });
  }

  return (
    <form
      aria-label="New message"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex min-w-0 flex-[1_1_460px] flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="text-lg font-semibold">New message</h2>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[13px] font-semibold">To</legend>
        <div role="tablist" aria-label="Choose recipients" className="inline-flex self-start rounded-lg bg-muted p-1">
          {(["roles", "people"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("min-h-9 rounded-md px-3.5 text-[13px] font-semibold", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {m === "roles" ? "By role" : "Pick people"}
            </button>
          ))}
        </div>
        {mode === "roles" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRoles((prev) => (on ? prev.filter((x) => x !== r) : [...prev, r]))}
                    className={cn("min-h-10 rounded-full border px-3.5 text-[13px] font-semibold", on ? "border-foreground bg-foreground text-background" : "border-input bg-card text-sidebar-foreground hover:bg-muted")}
                  >
                    {ROLE_PLURAL[r]} <span className="font-medium opacity-80">{roleCount(r)}</span>
                  </button>
                );
              })}
              <span className="flex min-h-10 items-center rounded-full border border-dashed border-input px-3.5 text-[13px] text-muted-foreground">Students · after student login</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                College (instructors)
                <Dropdown
                  value={college ?? ""}
                  onValueChange={(v) => setCollege(v || null)}
                  options={[{ value: "", label: "All colleges" }, ...asOptions(colleges)]}
                  className="w-40"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Hall (instructors)
                <Dropdown
                  value={hall ?? ""}
                  onValueChange={(v) => setHall(v || null)}
                  options={[{ value: "", label: "All halls" }, ...asOptions(halls)]}
                  searchPlaceholder="Search halls…"
                  className="w-36"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Search staff
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name…" className={input} />
            </label>
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {people.map((p) => {
                const on = ids.includes(p.id);
                return (
                  <li key={p.id} className="border-b border-muted last:border-b-0">
                    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm", on && "bg-accent/60")}>
                      <input type="checkbox" checked={on} onChange={() => setIds((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))} className="size-[18px] accent-primary" />
                      <span className="flex-1 font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_PLURAL[p.role].replace(/s$/, "")}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="text-[13px] font-semibold text-accent-strong" aria-live="polite">
          {recipients.length} {recipients.length === 1 ? "person" : "people"} will get this
          {recipients.length && recipients.length <= 6 ? `: ${recipients.map((r) => r.name).join(", ")}` : ""}
        </p>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Subject
        <input required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={cn(input, "font-normal")} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Message
        <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className={cn(input, "h-auto py-2.5 font-normal")} />
      </label>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Priority</legend>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
              className={cn(
                "flex min-h-12 flex-col justify-center rounded-lg border px-3.5 text-left text-[13px] font-semibold",
                priority === p ? (p === "urgent" ? "border-warning-strong bg-warning-soft text-warning" : "border-primary bg-accent text-accent-foreground") : "border-input bg-card",
              )}
            >
              {PRIORITY_INFO[p].label}
              <span className="text-[11px] font-medium opacity-80">{PRIORITY_INFO[p].hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-4 text-[13px]">
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" checked={requireAck} onChange={() => setRequireAck(!requireAck)} className="size-[18px] accent-primary" />
          Ask recipients to acknowledge
        </label>
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" checked={alsoEmail} onChange={() => setAlsoEmail(!alsoEmail)} className="size-[18px] accent-primary" />
          Also send by email <span className="text-muted-foreground">(once email is connected)</span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="h-11 gap-2 px-5" disabled={pending || !recipients.length || !subject.trim() || !body.trim()}>
          <Send aria-hidden="true" className="size-4" />
          {pending ? "Sending…" : `Send to ${recipients.length}`}
        </Button>
      </div>
    </form>
  );
}
