/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

"use client";

import { useEffect } from "react";
import { Download } from "lucide-react";

/*
 * Downloading a student report as a PDF uses the browser's own "Save as PDF": the browser lays out
 * the text itself, so Telugu letters join exactly as on screen and the text stays real, selectable
 * text. The page title becomes the suggested file name, and the app prints in its light theme.
 */

/** While printing: light theme (paper is white) and A4 with no page margin (the sheet has its own). */
export function PrintSetup() {
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains("dark");
      html.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) html.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return <style>{"@page { size: A4; margin: 0; }"}</style>;
}

export function DownloadPdfButton({ fileName, label = "Download PDF" }: { fileName: string; label?: string }) {
  function download() {
    const title = document.title;
    document.title = fileName;
    const restore = () => {
      document.title = title;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  return (
    <button
      type="button"
      onClick={download}
      className="flex h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 print:hidden"
    >
      <Download aria-hidden className="size-4" />
      {label}
    </button>
  );
}
