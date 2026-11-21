/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

import { z } from "zod";
import { hasEmoji } from "./emoji";

/** Languages shown in the room (labels only: nothing is compiled or run). */
export const LANGUAGES = [
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "c", label: "C" },
  { value: "text", label: "Plain text" },
] as const;
export type Language = (typeof LANGUAGES)[number]["value"];
const languageValues = LANGUAGES.map((l) => l.value) as [Language, ...Language[]];

/**
 * One pad's limits: plenty for interview code, small enough that a huge paste (by hand or by an
 * extension) can't freeze the editor or flood the live sync. The editor refuses more; so does the API.
 */
export const MAX_CODE = 50_000;
export const MAX_LINES = 2_000;
export const LIMIT_MESSAGE = `The code room holds up to ${MAX_LINES.toLocaleString("en-IN")} lines and ${MAX_CODE.toLocaleString("en-IN")} characters.`;
export const EMOJI_MESSAGE = "Emoji aren't allowed in the code room.";

/** Lines in `text` (without splitting it into an array). */
export function lineCount(text: string): number {
  let n = 1;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) n++;
  return n;
}

/** The room's code pad (stored as the room's one problem row). */
export type RoomProblem = { id: string; language: Language; code: string; version: number; updatedBy: string | null; updatedAt: string };
export type RoomState = {
  id: string;
  version: number;
  niatId: string;
  studentName: string;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
  interactionId: string | null;
  problems: RoomProblem[];
};

/** A room is named after the interaction and the day it was started: "Interaction · 19 Nov 2026". */
export const roomName = (createdAt: string) =>
  `Interaction · ${new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`;

/** Who is looking at the room: staff can end it; the student only writes code. */
export type RoomViewer = { kind: "staff"; name: string } | { kind: "student"; name: string };

/** Everything a client can ask the room to do (POST /api/rooms/[id]). */
export const roomOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("code"),
    problemId: z.string().uuid(),
    base: z.number().int().min(0),
    code: z
      .string()
      .max(MAX_CODE, LIMIT_MESSAGE)
      .refine((code) => lineCount(code) <= MAX_LINES, LIMIT_MESSAGE)
      .refine((code) => !hasEmoji(code), EMOJI_MESSAGE),
  }),
  z.object({ op: z.literal("language"), problemId: z.string().uuid(), language: z.enum(languageValues) }),
  z.object({ op: z.literal("close") }),
  z.object({ op: z.literal("reopen") }),
]);
export type RoomOp = z.infer<typeof roomOp>;

/** Ops only staff may send. */
export const STAFF_OPS: RoomOp["op"][] = ["close", "reopen"];
