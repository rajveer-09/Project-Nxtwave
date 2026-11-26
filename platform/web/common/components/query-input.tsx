"use client";

import { useRef, useState } from "react";
import { useResetWhenShown } from "@/common/lib/use-reset-when-shown";

/**
 * Search box for a <LiveForm> (the search goes in the URL). It goes back to the page's search when
 * that changes or the page is shown again (see useResetWhenShown), so it never shows text the
 * results don't use. Not while you're typing in it: a reply for "ab" mustn't wipe the "c" you added.
 */
export function QueryInput({ name = "q", value, placeholder, className }: { name?: string; value: string; placeholder: string; className?: string }) {
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  useResetWhenShown(() => {
    if (document.activeElement !== input.current) setText(value);
  }, value);
  return <input ref={input} type="search" name={name} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={className} />;
}
