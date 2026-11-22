/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { Check, Copy, Lock, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "@nxtone/interactions-ui/room/components/code-editor";
import { merge3 } from "@nxtone/interactions-ui/room/lib/merge";
import { LANGUAGES, roomName, type Language, type RoomOp, type RoomProblem, type RoomState, type RoomViewer } from "@nxtone/interactions-ui/room/lib/types";
import { Button } from "@/common/ui/button";
import { Dropdown } from "@/common/components/dropdown";
import { cn } from "@/common/lib/utils";

/** The pad's text as this person sees it, and the server version it was last in step with. */
type Local = { text: string; base: string; baseVersion: number };
type Sync = "live" | "saving" | "offline";
/** How changes travel: a live socket to the interactions service, or polling this app (fallback). */
type Transport = "connecting" | "socket" | "poll";

const POLL_MS = 700;
const HIDDEN_POLL_MS = 3000;
const PUSH_DELAY_MS = 250;
/** Socket: edits go out after a short pause in typing (the other person sees them right away). */
const SOCKET_PUSH_DELAY_MS = 120;
/** Wait after the server says "too many requests" (429). */
const RETRY_MS = 2000;
/** No answer to an edit for this long: the connection is treated as lost and re-opened. */
const ACK_TIMEOUT_MS = 10_000;
/** Reconnect attempts before falling back to polling for this visit. */
const MAX_RECONNECTS = 6;

type RoomMeta = { closedAt: string | null; closedBy: string | null; interactionId: string | null; language: string };
type ServerMessage =
  | { type: "hello"; clientId: string; room: RoomMeta; problem: RoomProblem; readOnly: boolean }
  | { type: "code"; problem: RoomProblem; origin: string | null }
  | { type: "conflict"; problem: RoomProblem }
  | { type: "room"; room: RoomMeta }
  | { type: "error"; message: string; retry?: boolean };

function fromProblem(p: RoomProblem): Local {
  return { text: p.code, base: p.code, baseVersion: p.version };
}

async function send(roomId: string, op: RoomOp) {
  const res = await fetch(`/api/rooms/${roomId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(op) });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body } as { status: number; body: { error?: string; conflict?: RoomProblem | null; problemVersion?: number } };
}

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 10 ? "just now" : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

/**
 * The live room: one code pad named after the interaction and its date. Whoever types, the other
 * sees it at once. The instructor can end the room; saving the interaction ends it too and keeps
 * the code with it.
 *
 * Changes travel over a WebSocket to the interactions service when it's available (a ticket from
 * /api/rooms/[id]/ticket); otherwise, or if the socket can't be re-opened, by polling this app.
 * Either way each edit carries the version it started from, and a stale one is merged and re-sent.
 */
export function CodeRoom({ initial, viewer, shareUrl }: { initial: RoomState; viewer: RoomViewer; shareUrl: string }) {
  const staff = viewer.kind === "staff";
  const [room, setRoom] = useState(initial);
  const [locals, setLocals] = useState<Record<string, Local>>(() => Object.fromEntries(initial.problems.map((p) => [p.id, fromProblem(p)])));
  const [sync, setSync] = useState<Sync>("live");
  const [transport, setTransport] = useState<Transport>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);

  const localsRef = useRef(locals);
  const versionRef = useRef(initial.version);
  const dirty = useRef(new Set<string>());
  const pushing = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const transportRef = useRef<Transport>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{ id: string; sent: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const messageRef = useRef<(m: ServerMessage) => void>(() => undefined);

  const updateLocals = useCallback((change: (prev: Record<string, Local>) => Record<string, Local>) => {
    localsRef.current = change(localsRef.current);
    setLocals(localsRef.current);
  }, []);

  const switchTransport = useCallback((next: Transport) => {
    transportRef.current = next;
    setTransport(next);
  }, []);

  /** Take in one pad from the server: someone's edit, merged with what this person hasn't sent yet. */
  const absorbProblem = useCallback(
    (p: RoomProblem) => {
      updateLocals((prev) => {
        const mine = prev[p.id];
        if (!mine) return { ...prev, [p.id]: fromProblem(p) };
        if (p.version <= mine.baseVersion) return prev;
        const merged = mine.text === mine.base ? p.code : merge3(mine.base, mine.text, p.code);
        if (merged !== p.code) dirty.current.add(p.id);
        return { ...prev, [p.id]: { text: merged, base: p.code, baseVersion: p.version } };
      });
      setRoom((r) => ({ ...r, problems: r.problems.map((x) => (x.id === p.id ? { ...p } : x)) }));
      if (dirty.current.size) setTimeout(() => void flushRef.current(), 0);
    },
    [updateLocals],
  );

  /** Take in the server's room (polling): other people's edits (merged with unsent typing). */
  const absorb = useCallback(
    (next: RoomState) => {
      versionRef.current = next.version;
      for (const p of next.problems) absorbProblem(p);
      setRoom(next);
    },
    [absorbProblem],
  );

  const applyMeta = useCallback((m: RoomMeta) => {
    setRoom((r) => ({ ...r, closedAt: m.closedAt, closedBy: m.closedBy, interactionId: m.interactionId, problems: r.problems.map((p) => ({ ...p, language: m.language as Language })) }));
  }, []);

  /** An edit is done (answered, refused or lost): send the next change, if any. */
  const settle = useCallback(() => {
    if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    pendingRef.current = null;
    pushing.current = false;
    if (dirty.current.size) void flushRef.current();
    else setSync("live");
  }, []);

  const flush = useCallback(async () => {
    if (pushing.current) return;
    const id = dirty.current.values().next().value as string | undefined;
    if (!id) {
      setSync("live");
      return;
    }
    const local = localsRef.current[id];
    if (!local || local.text === local.base) {
      dirty.current.delete(id);
      return flushRef.current();
    }

    // Live socket: send and wait for the room to answer (the answer is handled in onMessage).
    if (transportRef.current !== "poll") {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setSync(transportRef.current === "connecting" ? "saving" : "offline");
        return; // stays dirty; sent once the socket (re)opens
      }
      dirty.current.delete(id);
      pushing.current = true;
      setSync("saving");
      const sent = local.text;
      const timer = setTimeout(() => {
        // No answer: keep the text and re-open the connection.
        dirty.current.add(id);
        pendingRef.current = null;
        pushing.current = false;
        socketRef.current?.close(4000, "no answer");
      }, ACK_TIMEOUT_MS);
      pendingRef.current = { id, sent, timer };
      ws.send(JSON.stringify({ type: "edit", problemId: id, base: local.baseVersion, code: sent }));
      return;
    }

    // Polling: send over HTTP.
    dirty.current.delete(id);
    pushing.current = true;
    setSync("saving");
    const sent = local.text;
    try {
      const { status, body } = await send(room.id, { op: "code", problemId: id, base: local.baseVersion, code: sent });
      if (status === 200 && typeof body.problemVersion === "number") {
        updateLocals((prev) => ({ ...prev, [id]: { ...prev[id], base: sent, baseVersion: body.problemVersion! } }));
        if (localsRef.current[id].text !== sent) dirty.current.add(id);
        setError(null);
      } else if (status === 429) {
        // Too many saves at once: keep the text and send it again shortly.
        dirty.current.add(id);
        pushing.current = false;
        setTimeout(() => void flushRef.current(), RETRY_MS);
        return;
      } else if (status === 409 && body.conflict) {
        const theirs = body.conflict;
        updateLocals((prev) => {
          const cur = prev[id];
          return { ...prev, [id]: { text: merge3(cur.base, cur.text, theirs.code), base: theirs.code, baseVersion: theirs.version } };
        });
        dirty.current.add(id);
      } else {
        setError(body.error ?? "Couldn't save the code.");
        if (status >= 500 || status === 0) dirty.current.add(id);
      }
    } catch {
      dirty.current.add(id);
      setSync("offline");
      pushing.current = false;
      setTimeout(() => void flushRef.current(), 2000);
      return;
    }
    pushing.current = false;
    if (dirty.current.size) void flushRef.current();
    else setSync("live");
  }, [room.id, updateLocals]);

  /** One message from the room's socket. */
  const onMessage = useCallback(
    (m: ServerMessage) => {
      switch (m.type) {
        case "hello":
          clientIdRef.current = m.clientId;
          absorbProblem(m.problem);
          applyMeta(m.room);
          setError(null);
          // Anything typed while (re)connecting goes now.
          if (dirty.current.size) void flushRef.current();
          else setSync("live");
          return;
        case "code": {
          const pending = pendingRef.current;
          if (pending && m.origin && m.origin === clientIdRef.current && pending.id === m.problem.id) {
            updateLocals((prev) => ({ ...prev, [pending.id]: { ...prev[pending.id], base: pending.sent, baseVersion: m.problem.version } }));
            if (localsRef.current[pending.id].text !== pending.sent) dirty.current.add(pending.id);
            setRoom((r) => ({ ...r, problems: r.problems.map((x) => (x.id === m.problem.id ? { ...m.problem } : x)) }));
            setError(null);
            return settle();
          }
          return absorbProblem(m.problem);
        }
        case "conflict": {
          const pending = pendingRef.current;
          const theirs = m.problem;
          updateLocals((prev) => {
            const cur = prev[theirs.id];
            return cur ? { ...prev, [theirs.id]: { text: merge3(cur.base, cur.text, theirs.code), base: theirs.code, baseVersion: theirs.version } } : prev;
          });
          dirty.current.add(pending?.id ?? theirs.id);
          return settle();
        }
        case "room":
          return applyMeta(m.room);
        case "error": {
          const pending = pendingRef.current;
          if (m.retry && pending) {
            dirty.current.add(pending.id);
            if (pendingRef.current) clearTimeout(pendingRef.current.timer);
            pendingRef.current = null;
            pushing.current = false;
            setTimeout(() => void flushRef.current(), RETRY_MS);
            return;
          }
          setError(m.message);
          if (pending) settle();
        }
      }
    },
    [absorbProblem, applyMeta, settle, updateLocals],
  );

  useEffect(() => {
    flushRef.current = flush;
    messageRef.current = onMessage;
  }, [flush, onMessage]);

  // Live socket: connect with a fresh ticket, reconnect after a drop, fall back to polling if it can't.
  useEffect(() => {
    let stop = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | null = null;

    const later = () => {
      if (stop) return;
      attempts++;
      if (attempts > MAX_RECONNECTS) return switchTransport("poll");
      setSync("offline");
      timer = setTimeout(() => void connect(), Math.min(1000 * 2 ** (attempts - 1), 10_000));
    };

    const connect = async () => {
      if (stop) return;
      let ticket: { url: string | null; ticket?: string };
      try {
        const res = await fetch(`/api/rooms/${room.id}/ticket`, { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          setError("Your session ended. Sign in again to keep editing.");
          return;
        }
        ticket = await res.json();
      } catch {
        return later();
      }
      if (stop) return;
      if (!ticket.url || !ticket.ticket) return switchTransport("poll");
      ws = new WebSocket(`${ticket.url}?ticket=${encodeURIComponent(ticket.ticket)}`);
      socketRef.current = ws;
      ws.onopen = () => {
        attempts = 0;
        switchTransport("socket");
      };
      ws.onmessage = (event) => {
        try {
          messageRef.current(JSON.parse(String(event.data)) as ServerMessage);
        } catch {
          // ignore anything that isn't a room message
        }
      };
      ws.onclose = (event) => {
        if (socketRef.current === ws) socketRef.current = null;
        const pending = pendingRef.current;
        if (pending) {
          clearTimeout(pending.timer);
          dirty.current.add(pending.id);
          pendingRef.current = null;
          pushing.current = false;
        }
        if (stop) return;
        if (event.code === 4404) return setError("This room doesn't exist any more.");
        later();
      };
    };

    void connect();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      ws?.close(1000, "left");
    };
  }, [room.id, switchTransport]);

  // Polling (fallback): fast while the tab is visible, slowly when hidden.
  useEffect(() => {
    if (transport !== "poll") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let wait = 0;
      try {
        const res = await fetch(`/api/rooms/${room.id}?v=${versionRef.current}`, { cache: "no-store" });
        if (res.status === 429) wait = RETRY_MS;
        if (res.status === 200) {
          const body = (await res.json()) as { room: RoomState };
          if (!stop) absorb(body.room);
        }
        if (res.status === 200 || res.status === 204) setSync((s) => (s === "offline" ? "live" : s));
        else if (res.status === 401 || res.status === 403) {
          setError("Your session ended. Sign in again to keep editing.");
          return;
        }
      } catch {
        setSync("offline");
      }
      if (!stop) timer = setTimeout(poll, Math.max(wait, document.hidden ? HIDDEN_POLL_MS : POLL_MS));
    };
    timer = setTimeout(poll, 0);
    // Anything typed while connecting goes now.
    if (dirty.current.size) void flushRef.current();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [room.id, absorb, transport]);

  // Keep "edited 20s ago" fresh.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Don't lose unsent typing on close.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || pushing.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /** A short-lived message from the editor (emoji removed, too much code); saving doesn't clear it. */
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notice = useCallback((message: string) => {
    setEditorNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setEditorNotice(null), 5000);
  }, []);

  function typed(id: string, text: string) {
    updateLocals((prev) => ({ ...prev, [id]: { ...prev[id], text } }));
    dirty.current.add(id);
    setSync("saving");
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void flush(), transportRef.current === "poll" ? PUSH_DELAY_MS : SOCKET_PUSH_DELAY_MS);
  }

  async function act(op: RoomOp) {
    setError(null);
    const ws = socketRef.current;
    if (transportRef.current === "socket" && ws?.readyState === WebSocket.OPEN) {
      // The room answers everyone with the new state (or this person with an error).
      ws.send(JSON.stringify(op.op === "language" ? { type: "language", problemId: op.problemId, language: op.language } : { type: op.op }));
      return true;
    }
    const { status, body } = await send(room.id, op);
    if (status !== 200) {
      setError(body.error ?? "That didn't work. Try again.");
      return false;
    }
    // Show the result straight away rather than waiting for the next poll.
    const res = await fetch(`/api/rooms/${room.id}`, { cache: "no-store" });
    if (res.ok) absorb(((await res.json()) as { room: RoomState }).room);
    return true;
  }

  const closed = !!room.closedAt;
  const current = room.problems[0] ?? null;
  const name = roomName(room.createdAt);
  const local = current ? locals[current.id] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Code room</span>
          <h1 className="truncate text-lg font-semibold">
            {room.studentName} <span className="text-sm font-normal text-muted-foreground tabular">{room.niatId}</span>
          </h1>
          <span className="text-xs text-muted-foreground">
            Started by {room.createdBy} · {viewer.kind === "student" ? "you're the student" : `you're ${viewer.name === room.createdBy ? "the host" : "watching"}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncPill sync={closed ? "closed" : sync} />
          {staff ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied ? "Copied" : "Copy student link"}
              </Button>
              {closed ? (
                room.interactionId ? null : (
                  <Button type="button" variant="outline" className="h-9" onClick={() => void act({ op: "reopen" })}>
                    Reopen
                  </Button>
                )
              ) : (
                <Button type="button" variant="outline" className="h-9" onClick={() => void act({ op: "close" })}>
                  End room
                </Button>
              )}
            </>
          ) : null}
        </div>
      </header>

      {closed ? (
        <p role="status" className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-2.5 text-[13px] text-sidebar-foreground sm:px-6">
          <Lock aria-hidden="true" className="size-4" />
          {room.interactionId ? "Saved with the interaction." : `Ended by ${room.closedBy ?? "the instructor"}.`} The code below is read-only.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-b border-warning-border bg-warning-soft px-4 py-2.5 text-[13px] font-medium text-warning sm:px-6">
          {error}
        </p>
      ) : null}
      {editorNotice ? (
        <p role="alert" className="border-b border-warning-border bg-warning-soft px-4 py-2.5 text-[13px] font-medium text-warning sm:px-6">
          {editorNotice}
        </p>
      ) : null}

      <section aria-label="Code" className="flex min-h-[60vh] min-w-0 flex-1 flex-col gap-3 p-4 sm:px-6">
        {current && local ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{name}</h2>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                Language
                <Dropdown
                  value={current.language}
                  disabled={closed}
                  onValueChange={(v) => void act({ op: "language", problemId: current.id, language: v as Language })}
                  options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                  className="h-8 w-36 px-2.5 text-[13px]"
                />
              </label>
            </div>
            <CodeEditor key={current.id} value={local.text} onChange={(text) => typed(current.id, text)} onRejected={notice} readOnly={closed} label={`Code for ${name}`} />
            <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{current.updatedBy && current.code ? `Last saved edit by ${current.updatedBy} · ${timeAgo(current.updatedAt)}` : "No code yet"}</span>
              {closed ? null : <span>Saved automatically as you type · No emoji · Tab indents · Esc then Tab leaves the editor</span>}
            </p>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-input p-8 text-center text-[13px] text-muted-foreground">
            No code was written in this room.
          </div>
        )}
      </section>
    </div>
  );
}

function SyncPill({ sync }: { sync: Sync | "closed" }) {
  const meta = {
    live: { label: "Live", icon: <span className="size-2 rounded-full bg-primary" />, cls: "bg-accent text-accent-foreground" },
    saving: { label: "Saving…", icon: <span className="size-2 animate-pulse rounded-full bg-primary" />, cls: "bg-accent text-accent-foreground" },
    offline: { label: "Reconnecting…", icon: <WifiOff aria-hidden="true" className="size-3.5" />, cls: "bg-warning-soft text-warning" },
    closed: { label: "Ended", icon: <Lock aria-hidden="true" className="size-3.5" />, cls: "bg-muted text-muted-foreground" },
  }[sync];
  return (
    <span role="status" className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", meta.cls)}>
      {meta.icon}
      {meta.label}
    </span>
  );
}
