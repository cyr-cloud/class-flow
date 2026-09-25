"use client";
import { useState } from "react";
import { liveClient } from "@/lib/live/client";

export default function SaveResultsImage({ sessionId, slideId }: { sessionId: string; slideId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <div className="text-right">
    <button disabled={busy} className="rounded-full border border-line-strong bg-white px-3 py-2 text-xs text-ink disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage("");
      try {
        // Capture a single consistent response set at click time.
        const state = liveClient(sessionId).snapshot();
        const slide = state.deck?.slides.find(s => s.content?.id === slideId);
        if (!slide?.content) throw new Error("질문을 찾지 못했어요.");
        const { renderSurveyPdf } = await import("@/lib/lecture/renderSurveyPdf");
        const { renderAddedPage } = await import("@/lib/lecture/exportLessonPdf");
        const pages = slide.content.type === "survey"
          ? await renderSurveyPdf(slide.content, state.surveyResponses ?? [])
          : [await renderAddedPage(slide, state.wordResponses)];
        const name = `ClassFlow-${slide.slideNo}쪽-설문결과-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        let blob: Blob;
        if (pages.length === 1) blob = new Blob([new Uint8Array(pages[0])], { type: "image/png" });
        else {
          const { zipSync } = await import("fflate");
          blob = new Blob([new Uint8Array(zipSync(Object.fromEntries(pages.map((page, i) => [`${name}-${i + 1}.png`, page])), { level: 0 }))], { type: "application/zip" });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${name}.${pages.length === 1 ? "png" : "zip"}`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMessage(pages.length === 1 ? "PNG 다운로드를 시작했어요." : `전체 응답을 PNG ${pages.length}장으로 나눠 ZIP 다운로드를 시작했어요.`);
      } catch (e) { setMessage(e instanceof Error ? e.message : "이미지를 저장하지 못했어요."); }
      finally { setBusy(false); }
    }}>{busy ? "이미지 만드는 중…" : "이미지 저장"}</button>
    {message && <p role="status" className="mt-1 max-w-64 text-xs font-normal text-ink-soft">{message}</p>}
  </div>;
}
