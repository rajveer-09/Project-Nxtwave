/*

Author : Rajveer Sharma
Date : 28 Nov 2026
@ Nxtwave

*/

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/common/ui/button";
import { attendanceApi } from "@nxtone/attendance-ui/api";
import { InternshipAdminCard } from "@nxtone/attendance-ui/components/students/internship-admin";
import { RemoveStudentCard, StudentFormCard } from "@nxtone/attendance-ui/components/students/student-form";
import { adminFields, StudentProfile } from "@nxtone/attendance-ui/components/students/student-profile";
import { fmtDate, NOTICE, TermPicker, useTermParam } from "@nxtone/attendance-ui/components/students/ui";

/** DSA attendance › one student: exactly what the student sees, plus admin-only fields and tools. */
export function StudentDetail({ niatId, isOwner }: { niatId: string; isOwner: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const term = useTermParam();
  const profile = useQuery({ queryKey: ["attendance", "student", niatId, term], queryFn: () => attendanceApi.student(niatId, term), retry: false });
  const [panel, setPanel] = useState<"none" | "edit" | "remove">("none");
  const p = profile.data;

  const saveRemark = async (ym: string, remark: string) => {
    await attendanceApi.setRemark(niatId, ym, remark);
    await qc.invalidateQueries({ queryKey: ["attendance", "student", niatId] });
  };
  // Back keeps the list's filters (they live in its URL); a page opened in a new tab has no history.
  const back = () => (window.history.length > 1 ? router.back() : router.push("/attendance/students"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{p?.student.name ?? "Student"}</h2>
          <p className="text-[13px] text-muted-foreground">{p ? `${p.student.niat_id} · what this student sees, plus admin details` : niatId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TermPicker />
          <Button variant="outline" onClick={back}>
            <ArrowLeft /> Back
          </Button>
          {p ? (
            <>
              <Button variant="outline" aria-expanded={panel === "edit"} onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>
                <Pencil /> Edit
              </Button>
              <Button variant="outline" className="text-red-700 hover:text-red-800 dark:text-red-400" aria-expanded={panel === "remove"} onClick={() => setPanel(panel === "remove" ? "none" : "remove")}>
                <UserMinus /> Remove
              </Button>
            </>
          ) : null}
          <Link href="/attendance" className={buttonVariants()}>
            Mark attendance
          </Link>
        </div>
      </div>

      {profile.isLoading ? <p className="text-[13px] text-muted-foreground">Loading…</p> : null}
      {profile.error ? <p className={NOTICE.error}>{profile.error.message}</p> : null}
      {p && panel === "edit" ? <StudentFormCard key={p.student.niat_id} student={p.student} onDone={() => setPanel("none")} /> : null}
      {p && panel === "remove" ? <RemoveStudentCard student={p.student} today={p.today} isOwner={isOwner} onDone={() => setPanel("none")} /> : null}
      {p && p.student.status === "dropped" ? (
        <p className={NOTICE.warning}>
          This student is marked as dropped{p.student.dropped_on ? ` from ${fmtDate(p.student.dropped_on)}` : ""}. They don&apos;t appear in the student search or on the marking sheet.
          Use Edit to make them active again.
        </p>
      ) : null}
      {p ? (
        <StudentProfile
          key={`${p.student.niat_id}-${term}`}
          p={p}
          fetchMonth={(ym) => attendanceApi.studentMonth(p.student.niat_id, ym)}
          fetchRange={(from, to) => attendanceApi.studentRange(p.student.niat_id, from, to)}
          extraFields={adminFields(p.student)}
          onSaveRemark={saveRemark}
          periodsCard={<InternshipAdminCard p={p} />}
        />
      ) : null}
    </div>
  );
}
