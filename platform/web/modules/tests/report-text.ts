/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

/*
 * Every fixed word on a weekly test student report, in English and Telugu. This is the one place
 * the Telugu wording lives: nothing on the report is translated on the fly. Change Telugu text only
 * with a native Telugu speaker's review.
 *
 * Telugu style, kept throughout:
 * - honorific plural verbs for the student and instructor (రాశారు, సాధించారు), and "బోధకులు";
 * - a low score is "ఉత్తీర్ణత మార్కుకు చేరలేదు" (did not reach the pass mark), never "fail";
 * - names, NIAT IDs and technical terms (MCQ, Arrays, Prefix sum) stay in English as written;
 * - Western digits for marks and percentages; Telugu month and weekday names.
 */

export type ReportLang = "en" | "te";
export const REPORT_LANGS: { value: ReportLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "te", label: "తెలుగు" },
];
export const reportLang = (v: unknown): ReportLang => (v === "te" ? "te" : "en");

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
};
const WEEKDAYS = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  te: ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"],
};
const DAY_SHORT = {
  en: ["Su", "M", "T", "W", "Th", "F", "S"],
  te: ["ఆ", "సో", "మం", "బు", "గు", "శు", "శ"],
};
/** Step difficulty labels from the curriculum, with their Telugu meaning shown beside them. */
const STEP_TE: Record<string, string> = { Easy: "సులభం", Medium: "మధ్యస్థం", Hard: "కఠినం" };

const parts = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

export function reportText(lang: ReportLang) {
  const te = lang === "te";
  const date = (iso: string) => {
    const { y, m, d } = parts(iso);
    return `${d} ${MONTHS[lang][m - 1]} ${y}`;
  };
  const dayMonth = (iso: string) => {
    const { m, d } = parts(iso);
    return `${d} ${MONTHS[lang][m - 1]}`;
  };
  const range = (from: string, to: string) => {
    const a = parts(from);
    const b = parts(to);
    return a.m === b.m ? `${a.d}–${b.d} ${MONTHS[lang][b.m - 1]}` : `${dayMonth(from)} – ${dayMonth(to)}`;
  };
  return {
    lang,
    date,
    range,
    weekday: (iso: string) => WEEKDAYS[lang][parts(iso).dow],
    dayShort: (iso: string) => DAY_SHORT[lang][parts(iso).dow],

    reportTitle: te ? "వారపు పరీక్ష నివేదిక" : "Weekly test report",
    /** "Weekly Test 4" → "వారపు పరీక్ష 4"; any other name is kept as the admin wrote it. */
    testName: (name: string) => {
      const n = name.match(/^Weekly Test\s+(\d+)$/i)?.[1];
      return te && n ? `వారపు పరీక్ష ${n}` : name;
    },
    testShort: (name: string) => {
      const n = name.match(/(\d+)\s*$/)?.[1];
      return n ? (te ? `పరీక్ష ${n}` : `WT ${n}`) : name.slice(0, 8);
    },
    section: te ? "సెక్షన్" : "Section",
    level: (n: number) => (te ? `లెవెల్ ${n}` : `Level ${n}`),
    instructor: te ? "బోధకులు" : "Instructor",
    heldOn: (iso: string) => (te ? `పరీక్ష తేదీ: ${WEEKDAYS.te[parts(iso).dow]}, ${date(iso)}` : `Held ${WEEKDAYS.en[parts(iso).dow]}, ${date(iso)}`),
    semesterWeek: (semester: string | null, from: string, to: string) =>
      te ? `${semester ? `${semester} · ` : ""}${range(from, to)} వారం` : `${semester ? `${semester} · ` : ""}week of ${range(from, to)}`,

    totalScore: te ? "మొత్తం మార్కులు" : "Total score",
    result: {
      pass: te ? "ఉత్తీర్ణత సాధించారు" : "Passed",
      below: te ? "ఉత్తీర్ణత మార్కుకు చేరలేదు" : "Below the pass mark",
      incomplete: te ? "మార్కులు ఇంకా పూర్తి కాలేదు" : "Marks not complete yet",
      absent: te ? "పరీక్షకు హాజరు కాలేదు" : "Did not take the test",
      missing: te ? "ఫలితం ఇంకా నమోదు కాలేదు" : "Result not entered yet",
    },
    change: (diff: number, previousTotal: number) =>
      diff > 0
        ? te
          ? `▲ గత పరీక్ష (${previousTotal}) కంటే ${diff} మార్కులు ఎక్కువ`
          : `▲ ${diff} more than the last test (${previousTotal})`
        : diff < 0
          ? te
            ? `▼ గత పరీక్ష (${previousTotal}) కంటే ${-diff} మార్కులు తక్కువ`
            : `▼ ${-diff} less than the last test (${previousTotal})`
          : te
            ? `గత పరీక్షలో వచ్చినన్ని మార్కులే (${previousTotal})`
            : `Same as the last test (${previousTotal})`,
    averageLine: (average: number | null, passMark: number) =>
      te
        ? `${average !== null ? `పరీక్ష రాసిన అందరి సగటు ${average} · ` : ""}ఉత్తీర్ణత మార్కు ${passMark}`
        : `${average !== null ? `Average of all who took it ${average} · ` : ""}pass mark ${passMark}`,

    semesterAttendance: te ? "ఈ సెమిస్టర్ హాజరు" : "Attendance this semester",
    weekAttendance: te ? "గత వారం హాజరు" : "Attendance last week",
    daysOf: (present: number, counted: number) => (te ? `${counted} పని దినాల్లో ${present} రోజులు హాజరు` : `${present} of ${counted} counted days`),
    weekDaysOf: (present: number, counted: number, from: string, to: string) =>
      te ? `${counted} పని దినాల్లో ${present} రోజులు · ${range(from, to)}` : `${present} of ${counted} days · ${range(from, to)}`,
    noCountedDays: te ? "లెక్కించే పని దినాలు ఇంకా లేవు" : "No counted days yet",
    minimum: (pct: number) =>
      pct >= 75 ? (te ? "కనీసం కావాల్సిన 75% కంటే ఎక్కువ" : "At or above the 75% minimum") : te ? "కనీసం కావాల్సిన 75% కంటే తక్కువ" : "Below the 75% minimum",
    legendAbsent: te ? "గైర్హాజరు" : "Absent",
    legendNotCounted: te ? "లెక్కించని రోజు" : "Not counted",
    dayStatus: (status: "P" | "A" | null) => (status === "P" ? (te ? "హాజరు" : "present") : status === "A" ? (te ? "గైర్హాజరు" : "absent") : te ? "లెక్కించలేదు" : "not counted"),

    marksTitle: te ? "విభాగాల వారీగా మార్కులు" : "Marks by section",
    averageLegend: te ? "అందరి సగటు" : "Average of all",
    avgShort: te ? "సగటు" : "avg",
    marksSummary: (below: string[]) =>
      below.length
        ? te
          ? `${below.join(", ")} లో సగటు కంటే తక్కువ మార్కులు వచ్చాయి.`
          : `Below the average in ${below.join(", ")}.`
        : te
          ? "అన్ని విభాగాల్లోనూ సగటుకు సమానంగా లేదా అంతకంటే ఎక్కువ మార్కులు వచ్చాయి."
          : "At or above the average in every section.",

    historyTitle: te ? "ఇప్పటివరకు వారపు పరీక్షలు" : "Weekly tests so far",
    historyUnit: te ? "మొత్తం మార్కుల్లో శాతం" : "% of the total marks",
    passLine: (pct: number) => (te ? `ఉత్తీర్ణత ${pct}%` : `pass ${pct}%`),
    historyNone: te ? "ఇది మొదటి వారపు పరీక్ష." : "This is the first weekly test.",

    roadmapTitle: te ? "వ్యక్తిగత రోడ్‌మ్యాప్ పురోగతి" : "Personalised roadmap progress",
    levelDone: (level: number) => (te ? `లెవెల్ ${level} లో పూర్తైన భాగం` : `of Level ${level} done`),
    topicOf: (no: number, count: number, name: string) => (te ? `${count} అంశాల్లో ${no}వ అంశం · ${name}` : `Topic ${no} of ${count} · ${name}`),
    subtopic: (name: string) => (te ? `ఉప అంశం · ${name}` : `Subtopic · ${name}`),
    step: (code: string, label: string | null) => {
      const gloss = te && label && STEP_TE[label] ? ` (${STEP_TE[label]})` : "";
      return te ? `స్టెప్ ${code}${label ? ` · ${label}${gloss}` : ""}` : `Step ${code}${label ? ` · ${label}` : ""}`;
    },

    feedbackTitle: te ? "బోధకుల అభిప్రాయం" : "Instructor feedback",
    writtenInEnglish: te ? "బోధకులు దీన్ని ఆంగ్లంలో రాశారు" : "",
    noFeedback: te ? "అభిప్రాయం ఇంకా రాయలేదు." : "No feedback written yet.",
    yes: te ? "అవును" : "Yes",
    no: te ? "కాదు" : "No",

    footerNote: te
      ? "హాజరు: విద్యార్థి చేరిన రోజు నుండి, టర్మ్‌లోని పని దినాలను మాత్రమే లెక్కిస్తాం. రోడ్‌మ్యాప్ పురోగతి అంటే ప్రస్తుత లెవెల్‌లో విద్యార్థి ఎంత భాగం పూర్తి చేశారో."
      : "Attendance counts only working days in the term, from the day the student joined. Roadmap progress is how far through their current level the student is.",
    generated: (iso: string) => (te ? `రూపొందించిన తేదీ ${date(iso)}` : `Generated ${date(iso)}`),
  };
}

export type ReportText = ReturnType<typeof reportText>;
