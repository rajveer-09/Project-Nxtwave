/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

"use client";

import { useLayoutEffect, useRef } from "react";
import { mapCaret } from "@nxtone/interactions-ui/room/lib/merge";
import { cn } from "@/common/lib/utils";

const INDENT = "    ";

/**
 * Plain code editor: a monospace text area with line numbers. Tab indents (Shift+Tab outdents),
 * Enter keeps the indentation. Press Esc, then Tab, to move focus out. Text changed by the other
 * person is applied in place, keeping the caret where it was in the text.
 */
export function CodeEditor({ value, onChange, readOnly, label }: { value: string; onChange: (value: string) => void; readOnly?: boolean; label: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const escaped = useRef(false);

  // Remote changes: replace the text without losing the caret.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || el.value === value) return;
    const before = el.value;
    const focused = document.activeElement === el;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    el.value = value;
    if (focused) el.setSelectionRange(mapCaret(before, value, start), mapCaret(before, value, end));
  }, [value]);

  const emit = () => area.current && onChange(area.current.value);

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

  const lines = Math.max(1, value.split("\n").length);
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card font-mono text-[13.5px] leading-6">
      <div
        ref={gutter}
        aria-hidden="true"
        className="w-12 shrink-0 overflow-hidden border-r border-border bg-surface-subtle py-3 pr-2.5 text-right text-muted-foreground/70 select-none"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={area}
        defaultValue={value}
        onInput={emit}
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
