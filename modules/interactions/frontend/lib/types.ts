/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

import { z } from "zod";
import { isRealDate } from "@/common/lib/dates";

/** Outcome values used by the Interactions app today (kept so old logs map 1:1). */
export const STATUSES = ["Cleared", "In Progress", "Need to Revisit"] as const;
export type InteractionStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<InteractionStatus, string> = {
  Cleared: "Cleared",
  "In Progress": "In progress",
  "Need to Revisit": "Needs revisit",
};

export type AskedQuestion = { title: string; step?: string; offRoadmap: boolean };

export type Interaction = {
  id: string;
  niatId: string;
  studentName: string;
  date: string; // YYYY-MM-DD (IST)
  round: number;
  takenBy: string;
  /** The student's instructor now (falls back to pocAtTime when the student has none). */
  assignedInstructor: string;
  /** The student's instructor (POC) when the interaction was logged; differs from takenBy when a support POC took it. */
  pocAtTime: string;
  level: number;
  topics: string[];
  subtopics: string[];
  stepsReached: Record<string, string>;
  status: InteractionStatus;
  rating: number;
  questions: AskedQuestion[];
  tweakedQuestions: string;
  remarks: string;
  performedWell: string;
  improvementAreas: string;
  actionItems: string;
  meetRecording: string;
  transcriptUrl: string;
  transcriptText: string;
  createdBy: string;
  createdAt: string;
};

/** Taken by someone other than the student's POC at the time (a support POC covering). */
export const isSupport = (it: Pick<Interaction, "takenBy" | "pocAtTime">) => !!it.pocAtTime && it.takenBy !== it.pocAtTime;

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "Links must start with https://");

/** Validation shared by the form (client) and the server action (authoritative). */
export const interactionInput = z
  .object({
    niatId: z.string().regex(/^N\d{2}H\d{2}[AB]\d{4}$/, "Pick a student"),
    date: z.string().refine(isRealDate, "Pick a date"),
    takenBy: z.string().trim().min(1, "Pick who took the interaction"),
    level: z.number().int().min(0).max(7),
    topics: z.array(z.string().min(1)).min(1, "Pick a topic").max(1, "Pick one topic: log other topics as separate interactions"),
    subtopics: z.array(z.string().min(1)),
    stepsReached: z.record(z.string(), z.string()),
    status: z.enum(STATUSES),
    rating: z.number().min(0).max(5).multipleOf(0.5),
    questions: z
      .array(z.object({ title: z.string().trim().min(1).max(300), step: z.string().optional(), offRoadmap: z.boolean() }))
      .max(30),
    tweakedQuestions: z.string().max(4000),
    remarks: z.string().trim().min(1, "Add remarks").max(4000),
    performedWell: z.string().max(4000),
    improvementAreas: z.string().max(4000),
    actionItems: z.string().max(4000),
    meetRecording: httpsUrl,
    transcriptUrl: httpsUrl,
    transcriptText: z.string().max(200_000),
  })
  .superRefine((v, ctx) => {
    if (v.questions.length === 0 && !v.tweakedQuestions.trim()) {
      ctx.addIssue({ code: "custom", path: ["questions"], message: "Add at least one question asked" });
    }
  });

export type InteractionInput = z.infer<typeof interactionInput>;

/**
 * What an interaction covered, for lists: "Arrays › Array Traversal › Kadane's Algo" for one topic (as before),
 * "Maths, STL › Digit Manipulation, Stack" when several topics were covered in one interaction.
 */
export function coveredLabel(topics: string[], subtopics: string[]): string {
  if (topics.length <= 1) return [...topics, ...subtopics].join(" › ");
  return [topics.join(", "), subtopics.join(", ")].filter(Boolean).join(" › ");
}
