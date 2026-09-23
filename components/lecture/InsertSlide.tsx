"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/board/image";
import { cleanSurvey, type SurveyDisplay } from "@/lib/lecture/survey";
import { liveClient } from "@/lib/live/client";

export default function InsertSlide({ sessionId, page, side, disabled, open, onToggle, onClose }: {
  sessionId: string; page: number; side: "before" | "after"; disabled?: boolean;
  open: boolean; onToggle: () => void; onClose: () => void;
}) {
  const [type, setType] = useState<"wordcloud" | "image">("wordcloud");
  const [display, setDisplay] = useState<"wordcloud" | SurveyDisplay>("wordcloud");
  const [options, setOptions] = useState("");
  const [multiple, setMultiple] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const position = side === "before" ? "앞" : "뒤";
  return <div className="shrink-0">
    <button type="button" disabled={disabled || busy} aria-label={`이 페이지 ${position}에 추가`} title={`이 페이지 ${position}에 추가`} aria-expanded={open} onClick={() => { onToggle(); setError(""); }} className={`flex h-8 w-8 items-center justify-center rounded-full border text-2xl shadow-sm transition-colors sm:h-10 sm:w-10 ${open ? "border-mocha bg-mocha text-white" : "border-line-strong bg-paper text-mocha hover:border-mocha hover:bg-gardenia"} disabled:opacity-40`}>＋</button>
    {open && <form aria-label={`페이지 ${position}에 추가`} onSubmit={async e => {
      e.preventDefault(); if (lock.current) return;
      lock.current = true; setBusy(true); setError("");
      try {
        const expectedDeckUpdatedAt = liveClient(sessionId).snapshot().deck?.updatedAt ?? 0;
        let content;
        if (type === "image") {
          if (!file) throw new Error("이미지를 선택하거나 Ctrl+V로 붙여넣어 주세요.");
          const blob = await compressImage(file);
          const res = await fetch("/api/image", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error ?? "이미지를 저장하지 못했어요.");
          content = { id: crypto.randomUUID(), type: "image" as const, imageUrl: data.url };
        } else if (display === "wordcloud") content = { id: crypto.randomUUID(), type: "wordcloud" as const, prompt: title.trim() };
        else content = cleanSurvey({ id: crypto.randomUUID(), type: "survey", prompt: title.trim(), display, options: options.split(/\r?\n/).filter(o => o.trim()), multiple });
        await liveClient(sessionId).send({ action: "insertSlide", anchor: page, side, content, title: title.trim() || file?.name || "이미지", expectedDeckUpdatedAt });
        onClose(); setTitle(""); setFile(null);
      } catch (err) { setError(err instanceof Error ? err.message : "페이지를 추가하지 못했어요."); }
      finally { setBusy(false); lock.current = false; }
    }} onPaste={e => {
      if (type !== "image" || busy) return;
      const pasted = Array.from(e.clipboardData.files).find(f => ["image/png", "image/jpeg", "image/webp"].includes(f.type));
      if (pasted) { e.preventDefault(); setFile(pasted); }
    }} className="absolute inset-x-0 top-full z-30 mt-3 rounded-2xl border border-line bg-paper p-5 shadow-xl">
      <p className="mb-3 font-semibold">{page}쪽 {position}에 새 페이지</p>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">페이지 종류<select value={type} onChange={e => { setType(e.target.value as typeof type); setError(""); }} className="ml-3 rounded-lg border border-line p-2"><option value="wordcloud">실시간 참여 질문</option><option value="image">이미지</option></select></label>
        <label className="block text-sm">{type === "wordcloud" ? "학생에게 물어볼 질문" : "이미지 제목 (선택)"}<input autoFocus value={title} onChange={e => setTitle(e.target.value)} required={type === "wordcloud"} maxLength={160} placeholder={type === "wordcloud" ? display === "wordcloud" ? "오늘 배운 내용을 한 단어로 표현하면?" : display === "cards" ? "최신 기술과 자료는 어디서, 어떻게 구하시나요?" : "수업 준비에 AI를 얼마나 써보셨나요?" : "이미지 제목"} className="mt-2 w-full rounded-lg border border-line px-3 py-2" /></label>
        {type === "wordcloud" && <>
          <label className="block text-sm">결과 표시 방식<select value={display} onChange={e => setDisplay(e.target.value as typeof display)} className="ml-3 rounded-lg border border-line p-2"><option value="wordcloud">워드클라우드 · 짧은 단어</option><option value="cards">서술형 카드 · 긴 답변</option><option value="bar">막대그래프 · 선택형</option><option value="pie">파이그래프 · 선택형</option><option value="donut">도넛그래프 · 선택형</option></select></label>
          {display !== "wordcloud" && display !== "cards" && <><label className="block text-sm">선택지 (한 줄에 하나, 2~10개)<textarea value={options} onChange={e=>setOptions(e.target.value)} rows={4} required maxLength={1100} placeholder={'아직 사용해 보지 않았어요\n가끔 사용해요\n자주 사용해요'} className="mt-2 w-full rounded-lg border border-line p-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={multiple} onChange={e=>setMultiple(e.target.checked)} />복수 선택 허용</label></>}
          <p className="text-xs text-mute">{display === "cards" ? "최대 500자의 답변을 각각 카드로 표시합니다." : display === "wordcloud" ? "20자 이내의 표현을 빈도에 따라 크게 표시합니다." : "선택지별 응답 수와 비율을 실시간으로 표시합니다."}</p>
        </>}
        {type === "image" && <label className="block rounded-lg bg-cream p-3 text-sm">PNG·JPG·WebP 선택 또는 Ctrl+V 붙여넣기<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full" />{file && <span className="mt-2 block">선택한 파일: {file.name}</span>}</label>}
        <p className="text-xs text-mute">추가한 페이지로 이동하며 학생 화면에도 표시됩니다. 원본 PDF는 변경하지 않아요.</p>
        <div className="flex gap-2"><button className="rounded-full bg-ink px-5 py-2 text-sm text-white">{busy ? "추가 중…" : "페이지 추가"}</button><button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm">취소</button></div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-rosetan">{error}</p>}
    </form>}
  </div>;
}

