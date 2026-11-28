/*

Author : Rajveer Sharma
Date : 22 Nov 2026
@ Nxtwave

*/

import { cn } from "@/common/lib/utils";
import { reportText, type ReportLang } from "@/modules/tests/report-text";
import type { StudentReport } from "@/modules/tests/student-report";
import { bandLabel, type ResultValue } from "@/modules/tests/types";

/*
 * One student's weekly test report as an A4 sheet (210 × 297 mm), in English or Telugu. The sheet is
 * paper: fixed light colours in either app theme, so the screen matches the PDF. Every fixed word
 * comes from report-text.ts; free-text feedback is shown in Telugu only where the instructor wrote it.
 */

const INK = "text-[#15171C]";
const SOFT = "text-[#3D4250]";
const MUTED = "text-[#565C6B]";
const CARD = "rounded-[10px] border border-[#E2E4E9]";

function Bar({ value, max, average, label }: { value: number | null; max: number; average: number | null; label: string }) {
  const w = value !== null && max ? Math.min(100, (value / max) * 100) : 0;
  const a = average !== null && max ? Math.min(100, (average / max) * 100) : null;
  return (
    <div className="relative h-2.5 rounded-full bg-[#F0F2F5] print-exact" role="img" aria-label={label}>
      <div className="h-full rounded-full bg-[#2F55D4] print-exact" style={{ width: `${w}%` }} />
      {a !== null ? <div className="absolute -top-[3px] h-4 w-0.5 bg-[#15171C] print-exact" style={{ left: `calc(${a}% - 1px)` }} /> : null}
    </div>
  );
}

function History({ report, t }: { report: StudentReport; t: ReturnType<typeof reportText> }) {
  const h = report.history;
  if (!h.length) return <p className={cn("m-0 text-[11px]", MUTED)}>{t.historyNone}</p>;
  const W = 300;
  const x = (i: number) => (h.length === 1 ? W / 2 : 26 + (i * (W - 52)) / (h.length - 1));
  const y = (p: number) => 10 + (100 - p) * 0.9; // 0% → 100, 100% → 10
  const pass = h.at(-1)!.passPct;
  return (
    <svg viewBox={`0 0 ${W} 124`} className="block w-full" role="img" aria-label={h.map((p) => `${t.testShort(p.name)}: ${p.total}/${p.max}`).join(", ")}>
      <line x1="10" y1={y(0)} x2={W - 8} y2={y(0)} stroke="#E2E4E9" />
      <line x1="10" y1={y(pass)} x2={W - 8} y2={y(pass)} stroke="#9A4309" strokeDasharray="4 4" />
      <text x={W - 8} y={y(pass) - 4} textAnchor="end" fontSize="9" fill="#9A4309">
        {t.passLine(pass)}
      </text>
      {h.length > 1 ? (
        <polyline points={h.map((p, i) => `${x(i)},${y(p.pct)}`).join(" ")} fill="none" stroke="#2F55D4" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {h.map((p, i) => (
        <g key={`${p.name}-${p.heldOn}`}>
          <circle cx={x(i)} cy={y(p.pct)} r={p.current ? 5.5 : 4} fill="#2F55D4" stroke="#FFFFFF" strokeWidth="2" />
          <text x={x(i)} y={y(p.pct) - 9} textAnchor="middle" fontSize={p.current ? 10 : 9} fontWeight={p.current ? 700 : 400} fill={p.current ? "#15171C" : "#3D4250"}>
            {p.total}/{p.max}
          </text>
          <text x={x(i)} y="120" textAnchor="middle" fontSize="9" fontWeight={p.current ? 700 : 400} fill={p.current ? "#15171C" : "#565C6B"}>
            {t.testShort(p.name)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function valueOf(v: ResultValue, type: string, t: ReturnType<typeof reportText>): string | null {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
  if (typeof v === "boolean") return v ? t.yes : t.no;
  if (Array.isArray(v)) return v.join(", ");
  if (type === "rating") return `${v} / 5`;
  return String(v);
}

export function StudentReportSheet({ report: r, lang }: { report: StudentReport; lang: ReportLang }) {
  const t = reportText(lang);
  const te = lang === "te";
  const a = r.auto;
  const p = a?.progress;
  const label = (x: { label: string; labelTe: string | null }) => (te && x.labelTe ? x.labelTe : x.label);
  const took = r.result === "pass" || r.result === "below" || r.result === "incomplete";
  const below = r.marks.filter((m) => m.value !== null && m.average !== null && m.value < m.average).map(label);
  const counted = r.week.filter((d) => d.status);
  const fb = r.feedback.map((f) => ({ ...f, text: valueOf(f.value, f.type, t) })).filter((f) => f.text !== null || (te && f.valueTe));
  const long = fb.filter((f) => f.type === "long" || f.type === "short");
  const short = fb.filter((f) => !(f.type === "long" || f.type === "short"));
  const topicIndex = p?.topicNo ? p.topicNo - 1 : -1;
  const within = p && p.percent !== null && p.topicCount ? (p.percent / 100) * p.topicCount - topicIndex : 0;

  return (
    <article
      lang={lang}
      aria-label={`${r.student.name} · ${t.testName(r.test.name)}`}
      className={cn(
        "student-sheet mx-auto flex min-h-[297mm] w-[210mm] shrink-0 flex-col gap-3.5 bg-white px-[11mm] pt-[9mm] pb-[7mm] text-[12px] shadow-[0_1px_3px_rgba(21,23,28,.08),0_8px_24px_rgba(21,23,28,.06)] print:shadow-none",
        INK,
        te ? "font-telugu leading-[1.6] [&_h2]:font-telugu" : "font-sans leading-[1.45]",
      )}
    >
      <header className="flex items-start justify-between gap-6 border-b border-[#E2E4E9] pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("text-[11px] font-semibold", MUTED, !te && "tracking-[0.06em] uppercase")}>{t.reportTitle}</span>
          <h1 className="m-0 font-heading text-[27px] leading-[1.2] font-semibold">{r.student.name}</h1>
          <span className={SOFT}>
            {r.student.niatId} · {t.section} {r.student.section} · {t.level(p?.level ?? r.student.level)} · {t.instructor}: {r.student.instructor || "—"}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-[16px] font-semibold">
            {t.testName(r.test.name)} · {bandLabel(r.test.band)}
          </span>
          <span className={MUTED}>{t.heldOn(r.test.heldOn)}</span>
          <span className={MUTED}>{t.semesterWeek(a?.semesterName ?? null, r.weekRange.from, r.weekRange.to)}</span>
        </div>
      </header>

      <section className="grid grid-cols-[1.15fr_1fr_1fr] gap-3">
        <div className={cn("flex flex-col gap-1 rounded-[10px] border px-4 py-3 print-exact", r.result === "pass" ? "border-[#AFC0F5] bg-[#E8EDFC]" : r.result === "below" ? "border-[#F2CDB0] bg-[#FCEFE4]" : "border-[#E2E4E9] bg-[#FAFAFB]")}>
          <div className="flex items-center justify-between gap-2">
            <span className={cn("font-semibold", r.result === "below" ? "text-[#9A4309]" : "text-[#1F3BA6]")}>{t.totalScore}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-px text-[10.5px] font-bold print-exact",
                r.result === "pass" ? "bg-[#2F55D4] text-white" : r.result === "below" ? "bg-[#9A4309] text-white" : "bg-[#F0F2F5] text-[#3D4250]",
              )}
            >
              {t.result[r.result]}
            </span>
          </div>
          {took ? (
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-[42px] leading-none font-bold">{r.total ?? "—"}</span>
              <span className={cn("font-sans text-[18px]", SOFT)}>/ {r.max}</span>
              {r.total !== null ? <span className="ml-auto font-heading text-[18px] font-semibold text-[#1F3BA6]">{Math.round((r.total * 100) / (r.max || 1))}%</span> : null}
            </div>
          ) : (
            <span className={cn("py-2 font-heading text-[28px] font-semibold", MUTED)}>—</span>
          )}
          {r.total !== null && r.previous ? (
            <span className={cn("font-semibold", r.total < r.previous.total ? "text-[#9A4309]" : "text-[#1F3BA6]")}>{t.change(r.total - r.previous.total, r.previous.total)}</span>
          ) : null}
          <span className={SOFT}>{t.averageLine(r.average, r.passMark)}</span>
        </div>

        <div className={cn("flex flex-col gap-1 px-4 py-3", CARD)}>
          <span className={cn("font-semibold", MUTED)}>{t.semesterAttendance}</span>
          <span className={cn("font-heading text-[32px] leading-[1.1] font-semibold", a?.semester.pct !== null && a?.semester.pct !== undefined && a.semester.pct < 75 && "text-[#9A4309]")}>
            {a?.semester.pct ?? "—"}
            {a?.semester.pct !== null && a?.semester.pct !== undefined ? "%" : ""}
          </span>
          <span className={MUTED}>{a?.semester.counted ? t.daysOf(a.semester.present, a.semester.counted) : t.noCountedDays}</span>
          {a?.semester.pct !== null && a?.semester.pct !== undefined ? (
            <>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#F0F2F5] print-exact">
                <div className={cn("h-full rounded-full print-exact", a.semester.pct < 75 ? "bg-[#D9772E]" : "bg-[#2F55D4]")} style={{ width: `${a.semester.pct}%` }} />
              </div>
              <span className={cn("text-[10.5px]", a.semester.pct < 75 ? "font-semibold text-[#9A4309]" : MUTED)}>{t.minimum(a.semester.pct)}</span>
            </>
          ) : null}
        </div>

        <div className={cn("flex flex-col gap-1 px-4 py-3", CARD)}>
          <span className={cn("font-semibold", MUTED)}>{t.weekAttendance}</span>
          <span className={cn("font-heading text-[32px] leading-[1.1] font-semibold", a?.week.pct !== null && a?.week.pct !== undefined && a.week.pct < 75 && "text-[#9A4309]")}>
            {a?.week.pct ?? "—"}
            {a?.week.pct !== null && a?.week.pct !== undefined ? "%" : ""}
          </span>
          <span className={MUTED}>{a?.week.counted ? t.weekDaysOf(a.week.present, a.week.counted, r.weekRange.from, r.weekRange.to) : t.noCountedDays}</span>
          {r.week.length ? (
            <div className="flex gap-1" role="img" aria-label={r.week.map((d) => `${t.weekday(d.date)} ${t.dayStatus(d.status)}`).join(", ")}>
              {r.week.map((d) => (
                <span key={d.date} className="flex flex-1 flex-col items-center gap-px">
                  <span
                    className={cn(
                      "h-[16px] w-full rounded-[4px] print-exact",
                      d.status === "P" ? "bg-[#2F55D4]" : d.status === "A" ? "border-[1.5px] border-[#D9772E] bg-[#FCEFE4]" : "bg-[#F0F2F5]",
                    )}
                  />
                  <span className={cn("text-[9.5px]", d.status === "A" ? "font-bold text-[#9A4309]" : MUTED)}>{t.dayShort(d.date)}</span>
                </span>
              ))}
            </div>
          ) : null}
          {counted.some((d) => d.status === "A") || r.week.some((d) => !d.status) ? (
            <span className={cn("flex flex-wrap gap-x-2.5 text-[9.5px]", MUTED)}>
              {counted.some((d) => d.status === "A") ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-[2px] border border-[#D9772E] bg-[#FCEFE4] print-exact" />
                  {t.legendAbsent}
                </span>
              ) : null}
              {r.week.some((d) => !d.status) ? (
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-[2px] bg-[#E2E4E9] print-exact" />
                  {t.legendNotCounted}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-[1.15fr_1fr] gap-3">
        <section className={cn("flex flex-col gap-2 px-4 py-3", CARD)}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-[13px] font-semibold">{t.marksTitle}</h2>
            <span className={cn("flex items-center gap-1 text-[10.5px]", MUTED)}>
              <span className="inline-block h-3 w-0.5 bg-[#15171C] print-exact" />
              {t.averageLegend}
            </span>
          </div>
          {r.marks.map((m) => (
            <div key={m.id} className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{label(m)}</span>
                <span className="font-sans font-semibold whitespace-nowrap">
                  {m.value ?? "—"} / {m.max}
                  {m.average !== null ? <span className={cn("font-normal", MUTED)}> · {t.avgShort} {m.average}</span> : null}
                </span>
              </div>
              <Bar value={m.value} max={m.max} average={m.average} label={`${label(m)}: ${m.value ?? "—"} / ${m.max}`} />
            </div>
          ))}
          {r.total !== null ? <span className={cn("text-[11px]", MUTED)}>{t.marksSummary(below)}</span> : null}
        </section>

        <section className={cn("flex flex-col gap-1 px-4 py-3", CARD)}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-[13px] font-semibold">{t.historyTitle}</h2>
            <span className={cn("text-[10.5px]", MUTED)}>{t.historyUnit}</span>
          </div>
          <History report={r} t={t} />
        </section>
      </div>

      {p ? (
        <section className={cn("flex flex-col gap-2 px-4 py-3", CARD)}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[13px] font-semibold">{t.roadmapTitle}</h2>
            <span className={MUTED}>
              {t.level(p.level)}
              {r.roadmap.levelTitle ? ` · ${r.roadmap.levelTitle}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex shrink-0 flex-col">
              <span className="font-heading text-[28px] leading-none font-semibold">{p.percent === null ? "—" : `${p.percent}%`}</span>
              <span className={cn("text-[10px]", MUTED)}>{t.levelDone(p.level)}</span>
            </div>
            {r.roadmap.topics.length ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${r.roadmap.topics.length}, minmax(0, 1fr))` }} aria-hidden>
                  {r.roadmap.topics.map((name, i) => (
                    <span
                      key={name}
                      className="h-2.5 rounded-[3px] print-exact"
                      style={{
                        background:
                          i < topicIndex ? "#2F55D4" : i === topicIndex ? `linear-gradient(90deg, #2F55D4 ${Math.round(Math.max(0, Math.min(1, within)) * 100)}%, #AFC0F5 0)` : "#F0F2F5",
                      }}
                    />
                  ))}
                </div>
                <div className={cn("grid gap-[3px] font-sans text-[9px] leading-tight", MUTED)} style={{ gridTemplateColumns: `repeat(${r.roadmap.topics.length}, minmax(0, 1fr))` }}>
                  {r.roadmap.topics.map((name, i) => (
                    <span key={name} className={cn("truncate", i === topicIndex && "font-bold text-[#1F3BA6]")} title={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.topic ? <span className="rounded-full bg-[#E8EDFC] px-2.5 py-0.5 font-semibold text-[#1F3BA6] print-exact">{t.topicOf(p.topicNo, p.topicCount, p.topic)}</span> : null}
            {p.subtopic ? <span className={cn("rounded-full bg-[#F0F2F5] px-2.5 py-0.5 font-semibold print-exact", SOFT)}>{t.subtopic(p.subtopic)}</span> : null}
            {p.step && p.level > 0 ? <span className={cn("rounded-full bg-[#F0F2F5] px-2.5 py-0.5 font-semibold print-exact", SOFT)}>{t.step(p.step, p.stepLabel)}</span> : null}
          </div>
        </section>
      ) : null}

      <section className={cn("flex flex-1 flex-col gap-2.5 bg-[#FAFAFB] px-4 py-3 print-exact", CARD)}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-[13px] font-semibold">{t.feedbackTitle}</h2>
          {r.enteredBy ? (
            <span className={MUTED}>
              {r.enteredBy}
              {r.enteredOn ? ` · ${t.date(r.enteredOn)}` : ""}
            </span>
          ) : null}
        </div>
        {!fb.length ? <p className={cn("m-0", MUTED)}>{t.noFeedback}</p> : null}
        {long.length ? (
          <div className={cn("grid gap-3", long.length > 1 && "grid-cols-2")}>
            {long.map((f) => {
              const inTelugu = te && f.valueTe;
              return (
                <div key={f.id} className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-[#1F3BA6]">{label(f)}</span>
                  {/* Telugu report: the instructor's own Telugu where written; otherwise their English, said plainly. */}
                  <p lang={inTelugu ? "te" : "en"} className={cn("m-0 whitespace-pre-line", SOFT, te && !inTelugu && "font-sans leading-[1.45]")}>
                    {inTelugu ? f.valueTe : f.text}
                  </p>
                  {te && !inTelugu ? <span className={cn("text-[10px] italic", MUTED)}>{t.writtenInEnglish}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
        {short.length ? (
          <div className={cn("flex flex-wrap gap-x-5 gap-y-1", SOFT)}>
            {short.map((f) => (
              <span key={f.id}>
                <span className={MUTED}>{label(f)}</span> <b className="font-sans">{f.text}</b>
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <footer className={cn("flex justify-between gap-4 border-t border-[#E2E4E9] pt-2 text-[9.5px]", MUTED)}>
        <span>{t.footerNote}</span>
        <span className="whitespace-nowrap">{t.generated(r.generatedOn)}</span>
      </footer>
    </article>
  );
}
