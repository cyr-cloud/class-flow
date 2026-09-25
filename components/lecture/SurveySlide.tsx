"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { emptyLive, liveClient } from "@/lib/live/client";
import { useResponderId } from "@/lib/lecture/useDeck";
import { SURVEY_COLORS, surveyCounts, type SurveyContent } from "@/lib/lecture/survey";
import SaveResultsImage from "./SaveResultsImage";
const empty = () => emptyLive;
const LABELS = { cards: "서술형 응답 카드", bar: "막대그래프", pie: "파이그래프", donut: "도넛그래프" };

export default function SurveySlide({ sessionId, content, teacher }: { sessionId: string; content: SurveyContent; teacher: boolean }) {
  const subscribe = useCallback((fn: () => void) => liveClient(sessionId).subscribe(fn), [sessionId]);
  const snapshot = useCallback(() => liveClient(sessionId).snapshot(), [sessionId]);
  const state = useSyncExternalStore(subscribe, snapshot, empty);
  const responderId = useResponderId();
  const responses = (state.surveyResponses ?? []).filter(r => r.slideId === content.id);
  const mine = responses.find(r => r.responderId === responderId);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [choiceDraft, setChoiceDraft] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const text = textDraft ?? mine?.text ?? "";
  const choices = choiceDraft ?? mine?.choices ?? [];
  const rows = surveyCounts(content, responses);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let angle = 0;
  const gradient = rows.map((row, i) => { const start = angle; angle += total ? row.count / total * 360 : 0; return `${SURVEY_COLORS[i % SURVEY_COLORS.length]} ${start}deg ${angle}deg`; }).join(", ");
  const cards = content.display === "cards";
  return <section aria-label={LABELS[content.display]} className="flex h-full min-h-80 min-w-0 flex-col rounded-xl bg-[#faf7f2] p-4 text-ink sm:p-8">
    <div className="flex justify-between gap-3 text-xs font-semibold text-mocha"><span>{LABELS[content.display]}</span><span aria-live="polite">{responses.length}명 참여</span></div>
    {teacher && <div className="mt-2"><SaveResultsImage sessionId={sessionId} slideId={content.id} /></div>}
    <h2 className="my-4 break-words text-xl font-bold sm:text-3xl">{content.prompt}</h2>
    <div className="min-h-32 flex-1 overflow-y-auto" aria-label="실시간 응답 결과">
      {cards ? <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{responses.length ? responses.map(r => <article key={r.responderId} className="min-w-0 whitespace-pre-wrap rounded-2xl bg-[#eae9e7] p-5 text-base leading-relaxed [overflow-wrap:anywhere] sm:text-xl">{r.text}</article>) : <p className="col-span-full p-8 text-center text-mute">참가자들의 답변이 카드로 나타납니다.</p>}</div> : <div className={content.display === "bar" ? "space-y-4" : "flex flex-col items-center gap-6 lg:flex-row"}>
        {content.display !== "bar" && <div role="img" aria-label={`${LABELS[content.display]}: ${responses.length}명 참여. 항목별 수치는 아래 목록에 표시됩니다.`} className="relative aspect-square w-48 shrink-0 rounded-full sm:w-64" style={{ background: total ? `conic-gradient(${gradient})` : "#e2e0dc" }}>{content.display === "donut" && <div className="absolute inset-[25%] flex items-center justify-center rounded-full bg-[#faf7f2] text-xl font-bold">{responses.length}명</div>}</div>}
        <div className="w-full min-w-0 flex-1 space-y-4">{rows.map((row, i) => { const percent = total ? Math.round(row.count / total * 100) : 0; return <div key={i}>
          <div className="flex items-start justify-between gap-3 text-sm sm:text-lg"><span className="flex min-w-0 items-start gap-2"><span className="mt-1.5 h-3 w-3 shrink-0 rounded-sm" style={{background:SURVEY_COLORS[i % SURVEY_COLORS.length]}} /><span className="[overflow-wrap:anywhere]">{row.label}</span></span><strong className="shrink-0">{row.count}표 · {percent}%</strong></div>
          {content.display === "bar" && <div className="mt-2 h-7 overflow-hidden rounded-md bg-[#e2e0dc]"><div className="h-full transition-[width] duration-300" style={{width:`${percent}%`,background:SURVEY_COLORS[i % SURVEY_COLORS.length]}} /></div>}
        </div>; })}{!total && <p className="text-sm text-mute">아직 응답이 없습니다.</p>}<p className="text-xs text-mute">{content.multiple ? "복수 선택 · 비율은 전체 선택 수 기준입니다." : "비율은 전체 응답 수 기준입니다."}</p></div>
      </div>}
    </div>
    {teacher ? <p className="mt-4 text-center text-sm text-ink-soft">학생 화면에서 참여할 수 있어요. 다시 제출하면 이전 답변이 바뀝니다.</p> : <form className="mt-4 border-t border-line pt-4" onSubmit={async e => {
      e.preventDefault(); if(busy || !responderId) return; setBusy(true); setMessage("");
      try { await liveClient(sessionId).send({ action:"surveyRespond", slideId:content.id, responderId, ...(cards ? {text} : {choices}) }); setTextDraft(null); setChoiceDraft(null); setMessage("응답을 보냈어요. 다시 제출하면 이전 답변이 바뀝니다."); }
      catch(error) {setMessage(error instanceof Error ? error.message : "응답을 보내지 못했어요.");} finally {setBusy(false);}
    }}>
      {cards ? <label className="block text-sm">내 답변<textarea value={text} onChange={e => setTextDraft(e.target.value)} maxLength={500} required disabled={busy} rows={3} placeholder="어디서, 어떻게 찾는지 편하게 적어주세요. (500자 이내)" className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-white p-3" /><span className="text-xs text-mute">{text.length}/500자 · 제출한 답변은 참여자에게 익명으로 표시됩니다.</span></label> : <fieldset disabled={busy}><legend className="mb-2 text-sm">{content.multiple ? "해당하는 항목을 모두 선택해 주세요." : "한 가지를 선택해 주세요."}</legend><div className="grid gap-2 sm:grid-cols-2">{content.options.map((option,i) => <label key={i} className="flex items-start gap-2 rounded-lg border border-line bg-white p-3 text-sm"><input className="mt-1" type={content.multiple ? "checkbox" : "radio"} name={`survey-${content.id}`} checked={choices.includes(i)} onChange={() => setChoiceDraft(content.multiple ? choices.includes(i) ? choices.filter(n=>n!==i) : [...choices,i] : [i])} /><span className="[overflow-wrap:anywhere]">{option}</span></label>)}</div></fieldset>}
      <button disabled={busy || !responderId || (cards ? !text.trim() : !choices.length)} className="mt-3 rounded-xl bg-ink px-5 py-3 text-white disabled:opacity-40">{busy ? "전송 중…" : mine ? "답변 바꾸기" : "참여하기"}</button><p role="status" className="mt-2 text-sm text-mocha">{message}</p>
    </form>}
  </section>;
}
