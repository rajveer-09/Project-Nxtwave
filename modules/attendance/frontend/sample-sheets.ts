/*

Author : Rajveer Sharma
Date : 19 Nov 2026
@ Nxtwave

*/

/**
 * Sample import sheets (fictional N99… students), offered as downloads on the Imports page so
 * admins can see the expected columns. Same content as the attendance dashboard's public/sample-*.csv.
 */
export const SAMPLE_SHEETS = {
  students: {
    name: "sample-students.csv",
    csv: [
      "NIAT ID,Student Name,Degree,Section,Hall No.,Level,19-Aug-2026,20-Aug-2026",
      "N99H01A0009,Aarav Mehta,BITS,S002,Hall 2,Level 1,Present,Absent",
      "N99H01A0010,Kavya Nair,BITS,S002,Hall 2,Level 1,Present,Present",
      "N99H01B0011,Rohan Das,CDU,S010,Hall 3,Level 0,Absent,Absent",
      "N99H01B0012,Tanvi Joshi,CDU,S010,Hall 3,Level 0,Present,",
    ],
  },
  attendance: {
    name: "sample-attendance.csv",
    csv: [
      "NIAT ID,Student Name,Degree,Section,Hall No.,Level,25-Oct-2026,26-Oct-2026,27-Oct-2026,28-Oct-2026",
      "N99H01A0003,Ishita Agarwal,BITS,S001,Hall 1,Level 2,,Present,Absent,",
      "N99H01A0004,Aditya Rao,BITS,S001,Hall 1,Level 2,,,,P",
      "N99H01A0007,Anika Gupta,BITS,S001,Hall 1,Level 2,P,a,0,1",
      "N99H01A0999,Unknown Student,BITS,S001,Hall 1,Level 2,,P,P,P",
    ],
  },
  calendar: {
    name: "sample-calendar.csv",
    csv: [
      "Date,Day Type,Applies To,Label,Counts",
      "2026-11-09,Holiday,All,Diwali,",
      "10-Nov-2026,Exam,CDU,CDU mid-semester exams,",
      "11/11/2026,Event,BITS,Hackathon,No",
      "12-Nov-2026,Event,All,Guest lecture,Yes",
    ],
  },
} as const;

/** Saves a sample sheet in the browser. */
export function downloadSample(kind: keyof typeof SAMPLE_SHEETS) {
  const sheet = SAMPLE_SHEETS[kind];
  const url = URL.createObjectURL(new Blob([sheet.csv.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = sheet.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
