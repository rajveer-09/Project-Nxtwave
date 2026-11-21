/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { hasEmoji, stripEmoji } from "@nxtone/interactions-ui/room/lib/emoji";
import { diffHunk, mapCaret } from "@nxtone/interactions-ui/room/lib/merge";
import { EMOJI_MESSAGE, LIMIT_MESSAGE, MAX_CODE, MAX_LINES, lineCount } from "@nxtone/interactions-ui/room/lib/types";
import { cn } from "@/common/lib/utils";

const INDENT = "    ";

/**
 * Plain code editor: a monospace text area with line numbers. Tab indents (Shift+Tab outdents),
 * Enter keeps the indentation. Press Esc, then Tab, to move focus out. Text changed by the other
 * person is applied in place, keeping the caret where it was in the text.
 *
 * Guards: emoji are removed as they're typed or pasted, and a change that would take the pad past
 * MAX_CODE characters or MAX_LINES lines is undone (a paste is refused before it's inserted), with
 * `onRejected` saying why. Changes made by scripts or extensions go through the same check.
 */
export function CodeEditor({
  value,
  onChange,
  onRejected,
  readOnly,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onRejected?: (message: string) => void;
  readOnly?: boolean;
  label: string;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);
  /** The last text that passed the guards: what a refused change goes back to. */
  const accepted = useRef(value);

  // Remote changes: replace the text without losing the caret.
  useLayoutEffect(() => {
    accepted.current = value;
    const el = area.current;
    if (!el || el.value === value) return;
    const before = el.value;
    const focused = document.activeElement === el;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    el.value = value;
    if (focused) el.setSelectionRange(mapCaret(before, value, start), mapCaret(before, value, end));
  }, [value]);

  const emit = () => {
    const el = area.current;
    if (!el) return;
    let text = el.value;
    if (hasEmoji(text)) {
      const caret = stripEmoji(text.slice(0, el.selectionEnd)).length;
      text = stripEmoji(text);
      el.value = text;
      el.setSelectionRange(caret, caret);
      onRejected?.(EMOJI_MESSAGE);
    }
    if (text.length > MAX_CODE || lineCount(text) > MAX_LINES) {
      const back = accepted.current;
      const at = diffHunk(back, text)?.start ?? back.length;
      el.value = back;
      el.setSelectionRange(at, at);
      onRejected?.(LIMIT_MESSAGE);
      return;
    }
    if (text === accepted.current) return;
    accepted.current = text;
    onChange(text);
  };

  /** Checks a paste before the browser inserts it: a huge one never reaches the page. */
  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    const pasted = event.clipboardData.getData("text/plain");
    const { selectionStart: s, selectionEnd: e, value: text } = el;
    if (text.length - (e - s) + pasted.length > MAX_CODE || lineCount(text.slice(0, s)) + lineCount(pasted) + lineCount(text.slice(e)) - 2 > MAX_LINES) {
      event.preventDefault();
      onRejected?.(LIMIT_MESSAGE);
      return;
    }
    if (hasEmoji(pasted)) {
      event.preventDefault();
      el.setRangeText(stripEmoji(pasted), s, e, "end");
      emit();
      onRejected?.(EMOJI_MESSAGE);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    if (event.key === "Escape") {
      escaped.current = true;
      return;
    }
    if (event.key === "Tab") {
      if (escaped.current) return; // let focus move on
      event.preventDefault();
      const { selectionStart: s, selectionEnd: e, value: text } = el;
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      if (event.shiftKey || text.slice(s, e).includes("\n")) {
        // Indent or outdent every selected line.
        const block = text.slice(lineStart, e);
        const lines = block.split("\n");
        const changed = lines.map((line) => (event.shiftKey ? line.replace(/^( {1,4}|\t)/, "") : INDENT + line)).join("\n");
        el.setRangeText(changed, lineStart, e, "preserve");
        el.setSelectionRange(lineStart, lineStart + changed.length);
      } else {
        el.setRangeText(INDENT, s, e, "end");
      }
      emit();
      return;
    }
    escaped.current = false;
    if (event.key === "}" || event.key === "]" || event.key === ")") {
      // A closing bracket on an otherwise blank line goes back one level.
      const { selectionStart: s, selectionEnd: e, value: text } = el;
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      const before = text.slice(lineStart, s);
      if (s === e && /^ {4,}$/.test(before)) {
        event.preventDefault();
        el.setRangeText(before.slice(INDENT.length) + event.key, lineStart, s, "end");
        emit();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const { selectionStart: s, selectionEnd: e, value: text } = el;
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      const line = text.slice(lineStart, s);
      const indent = line.match(/^[ \t]*/)?.[0] ?? "";
      const opens = /[{[(:]\s*$/.test(line);
      event.preventDefault();
      el.setRangeText(`\n${indent}${opens ? INDENT : ""}`, s, e, "end");
      emit();
    }
  }

  // Line numbers as one block of text (one element per line made long pads slow to type in).
  const lines = useMemo(() => lineCount(value), [value]);
  const numbers = useMemo(() => Array.from({ length: lines }, (_, i) => i + 1).join("\n"), [lines]);
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card font-mono text-[13.5px] leading-6">
      <div
        ref={gutter}
        aria-hidden="true"
        className="w-12 shrink-0 overflow-hidden border-r border-border bg-surface-subtle py-3 pr-2.5 text-right whitespace-pre text-muted-foreground/70 select-none"
      >
        {numbers}
      </div>
      <textarea
        ref={area}
        defaultValue={value}
        onInput={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        readOnly={readOnly}
        aria-label={label}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        placeholder={readOnly ? "" : "// Write your code here"}
        className={cn("min-h-0 flex-1 resize-none bg-transparent px-3.5 py-3 text-foreground [tab-size:4] outline-none", readOnly && "cursor-default")}
      />
    </div>
  );
}
