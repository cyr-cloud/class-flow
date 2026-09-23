"use client";

import { useEffect, useState } from "react";
import type { SlideNote } from "@/lib/lecture/pptxNotes";

export default function SpeakerNotes({ sessionId, page, added, source }: {
  sessionId: string; page: number; added: boolean; source: "sample" | "cloud" | "local" | "pdf";
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<SlideNote[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || notes || source === "pdf") return;
    let active = true;
    async function load() {
      try {
        let result: SlideNote[];
        if (source === "cloud") {
          const { originalSharedPpt } = await import("@/lib/conversion/client");
          const { extractNotes } = await import("@/lib/lecture/pptxNotes");
          result = extractNotes(await originalSharedPpt(sessionId));
        } else {
          const url = source === "sample" ? "/api/speaker-notes" : "/api/local-material";
          const response = await fetch(`${url}?sessionId=${encodeURIComponent(sessionId)}`, {
            headers: { "x-teacher-token": localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "" }, cache: "no-store",
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "대본을 불러오지 못했어요.");
          result = body.notes;
        }
        if (active) setNotes(result);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "대본을 불러오지 못했어요."); }
    }
    void load();
    return () => { active = false; };
  }, [open, notes, source, sessionId, attempt]);
  const text = notes?.find(note => note.slideNo === page)?.text.trim();

  return <section className="mt-4 rounded-2xl border border-line bg-paper">
    <button type="button" aria-expanded={open} aria-controls="speaker-notes" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-semibold text-ink">
      <span>강의 대본 <span className="ml-2 text-xs font-normal text-mute">강사 화면 전용</span></span><span>{open ? "접기 ▴" : "펼치기 ▾"}</span>
    </button>
    {open && <div id="speaker-notes" className="border-t border-line px-5 py-5">
      <p className="mb-3 text-xs text-mute">슬라이드를 넘기면 대본도 바뀝니다. 이 화면 자체를 화면 공유하면 대본도 보일 수 있어요.</p>
      {added ? <p className="text-ink-soft">추가한 참여형·이미지 페이지에는 발표자 노트가 없어요.</p>
        : source === "pdf" ? <p className="text-ink-soft">PDF에는 발표자 노트가 없어요. 대본이 포함된 PPTX를 올려 주세요.</p>
        : error ? <p role="alert">{error} <button className="ml-2 underline" onClick={() => { setError(""); setAttempt(a => a + 1); }}>다시 불러오기</button></p>
        : !notes ? <p role="status">PPT에서 강의 대본을 불러오는 중이에요…</p>
        : <p className="whitespace-pre-wrap break-words text-lg leading-loose text-ink">{text || "이 슬라이드에는 발표자 노트가 없어요."}</p>}
    </div>}
  </section>;
}
