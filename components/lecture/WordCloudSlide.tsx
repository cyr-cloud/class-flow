"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { emptyLive, liveClient } from "@/lib/live/client";
import { useResponderId } from "@/lib/lecture/useDeck";

const empty = () => emptyLive;
const COLORS = ["#795442", "#456276", "#667a45", "#a44747", "#765a8c"];

export default function WordCloudSlide({ sessionId, slideId, prompt, teacher }: {
  sessionId: string; slideId: string; prompt: string; teacher: boolean;
}) {
  const subscribe = useCallback((fn: () => void) => liveClient(sessionId).subscribe(fn), [sessionId]);
  const snapshot = useCallback(() => liveClient(sessionId).snapshot(), [sessionId]);
  const state = useSyncExternalStore(subscribe, snapshot, empty);
  const responderId = useResponderId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const responses = (state.wordResponses ?? []).filter(r => r.slideId === slideId);
  const mine = responses.find(r => r.responderId === responderId);
  const grouped = new Map<string, { word: string; count: number }>();
  for (const response of responses) {
    const key = response.word.toLocaleLowerCase();
    const entry = grouped.get(key);
    if (entry) entry.count++; else grouped.set(key, { word: response.word, count: 1 });
  }
  const words = [...grouped.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));
  const max = words[0]?.count ?? 1;

  return <section aria-label="실시간 워드클라우드" className="flex h-full min-h-80 flex-col rounded-xl bg-[#faf7f2] p-5 text-ink sm:p-8">
    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-mocha"><span>실시간 워드클라우드</span><span aria-live="polite">{responses.length}명 참여</span></div>
    <h2 className="mt-3 break-words text-center text-xl font-bold sm:text-3xl">{prompt}</h2>
    <div className="my-5 flex min-h-32 flex-1 flex-wrap content-center items-center justify-center gap-x-5 gap-y-3 overflow-y-auto" aria-label="모인 단어">
      {words.length ? words.map(({ word, count }, i) => <span key={word} title={`${word}: ${count}명`} className="max-w-full break-words font-bold transition-all" style={{ color: COLORS[i % COLORS.length], fontSize: `${Math.round(18 + 30 * count / max)}px` }}>{word}<small className="ml-1 align-super text-xs opacity-60">{count}</small></span>) : <p className="text-center text-mute">학생들의 단어가 이곳에 모여요.<br />많이 나온 단어일수록 크게 보여요.</p>}
    </div>
    {teacher ? <p className="text-center text-sm text-ink-soft">학생 화면에서 참여할 수 있어요. 한 사람당 한 표현씩, 다시 제출하면 바뀝니다.</p> : <form onSubmit={async e => {
      e.preventDefault(); if (busy || !responderId) return;
      setBusy(true); setMessage("");
      try { await liveClient(sessionId).send({ action: "wordRespond", slideId, responderId, word: draft }); setMessage("참여했어요! 다시 제출하면 내 단어가 바뀝니다."); setDraft(""); }
      catch (error) { setMessage(error instanceof Error ? error.message : "응답을 보내지 못했어요."); }
      finally { setBusy(false); }
    }}>
      <label className="mb-2 block text-sm" htmlFor={`word-${slideId}`}>{mine ? `내 단어: ${mine.word}` : "떠오르는 단어나 짧은 표현을 적어 주세요."}</label>
      <div className="flex gap-2"><input id={`word-${slideId}`} value={draft} onChange={e => setDraft(e.target.value)} maxLength={20} required disabled={busy} placeholder="20자 이내" className="min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-4 py-3" /><button disabled={busy || !draft.trim()} className="shrink-0 rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-40">{busy ? "전송 중…" : mine ? "바꾸기" : "참여하기"}</button></div>
      <p role="status" className="mt-2 min-h-5 text-sm text-mocha">{message}</p>
    </form>}
  </section>;
}
