"use client";

// 실습 슬라이드에서 여는 화면 — 안내문을 읽고, 다 하면 그 자리에서 결과물을 올린다.
//
// 게시판을 따로 두지 않고 수업 안에 담는다. 수업 상태는 이미 공유 저장소에 있어서
// 학생이 올린 결과물이 다른 기기에서도 바로 보인다.

import { useCallback, useMemo, useRef, useState } from "react";
import { DeckSlide, LabPost } from "@/lib/types";
import { liveClient, responderId } from "@/lib/live/client";
import GuideMarkdown from "./GuideMarkdown";
import LabGallery from "./LabGallery";
import { printSubmissions } from "@/lib/lecture/printSubmissions";

type Tab = "guide" | "gallery";

export default function LabPanel({
  sessionId,
  slide,
  posts,
  role,
  startOn,
  onClose,
}: {
  sessionId: string;
  slide: DeckSlide;
  posts: LabPost[];
  role: "teacher" | "student";
  startOn: Tab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(slide.guide || role === "teacher" ? startOn : "gallery");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const me = responderId();

  const mine = useMemo(
    () => posts.filter((p) => p.slideNo === slide.slideNo),
    [posts, slide.slideNo],
  );

  async function uploadGuide(file: File) {
    setError("");
    setNotice("");
    setUploading(true);
    try {
      if (!/\.(md|markdown)$/i.test(file.name)) throw new Error(".md 또는 .markdown 파일을 선택해 주세요.");
      if (file.size > 200 * 1024) throw new Error("가이드는 200KB 이하로 올려주세요.");
      const markdown = await file.text();
      if (!markdown.trim()) throw new Error("가이드 내용이 비어 있어요.");
      await liveClient(sessionId).send({ action: "guide", slideNo: slide.slideNo, markdown });
      setNotice("가이드를 저장했어요. 학생 화면에도 바로 반영됩니다.");
      setTab("guide");
    } catch (e) {
      setError(e instanceof Error ? e.message : "가이드를 올리지 못했어요.");
    } finally {
      setUploading(false);
    }
  }

  const remove = useCallback(
    (postId: string) => {
      void liveClient(sessionId)
        .send({ action: "removePost", postId, ownerId: me })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "지우지 못했어요."),
        );
    },
    [me, sessionId],
  );

  const like = useCallback(
    (postId: string) => {
      void liveClient(sessionId)
        .send({ action: "likePost", postId, ownerId: me })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "좋아요를 보내지 못했어요."),
        );
    },
    [me, sessionId],
  );

  const tabClass = (value: Tab) =>
    `-mb-px border-b-2 px-4 py-3 text-[15px] font-medium transition-colors ${
      tab === value
        ? "border-mocha text-mocha-deep"
        : "border-transparent text-mute hover:text-ink"
    }`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-cream">
      <header className="shrink-0 border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 pb-0 pt-6">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <span className="mt-1 shrink-0 rounded-full bg-mocha px-3.5 py-1.5 text-sm font-semibold text-white">
              실습 {slide.labNo}
            </span>
            <h2 className="min-w-0 flex-1 text-2xl font-bold leading-snug text-ink sm:text-3xl">
              {slide.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
            >
              ← 수업으로
            </button>
          </div>

          {/* 가이드 ↔ 결과물 — 밑줄 달린 진짜 탭으로 보이게 */}
          <div className="mt-5 flex gap-1">
            {(slide.guide || role === "teacher") && (
              <button type="button" onClick={() => setTab("guide")} className={tabClass("guide")}>
                실습가이드
              </button>
            )}
            <button type="button" onClick={() => setTab("gallery")} className={tabClass("gallery")}>
              결과물
              {mine.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gardenia px-1.5 py-0.5 text-xs tabular-nums text-ink-soft">
                  {mine.length}
                </span>
              )}
            </button>
          </div>
          {role === "teacher" && (
            <div className="flex flex-wrap items-center gap-3 py-3">
              <input ref={fileInput} type="file" accept=".md,.markdown,text/markdown" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadGuide(file);
              }} />
              <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-50">
                {uploading ? "저장 중…" : slide.guide ? "마크다운 가이드 교체" : "마크다운 가이드 올리기"}
              </button>
              {tab === "gallery" && <button type="button" disabled={!mine.some(p => p.createdAt !== 0)} onClick={() => {
                setError("");
                void printSubmissions(`실습 ${slide.labNo} · ${slide.title}`, mine).catch(e => setError(e instanceof Error ? e.message : "PDF 저장 창을 열지 못했어요."));
              }} className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-40">제출물 PDF로 저장</button>}
              <span className="text-xs text-mute">.md / .markdown · 최대 200KB · 텍스트 가이드 (외부 이미지 첨부 제외)</span>
            </div>
          )}
          {error && <p role="alert" className="pb-3 text-sm text-rosetan">{error}</p>}
          {notice && <p role="status" className="pb-3 text-sm text-mocha-deep">{notice}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "guide" ? (
          // 안내문은 읽는 글이라 한 단 폭으로 좁게
          <div className="mx-auto max-w-3xl px-6 py-7">
            {slide.guide ? <GuideMarkdown source={slide.guide} /> : <p className="py-10 text-center text-ink-soft">위 ‘마크다운 가이드 올리기’에서 실습 안내 파일을 선택해 주세요.</p>}
            <div className="mt-10 rounded-2xl border border-mocha/30 bg-mocha-tint px-6 py-6 text-center">
              <p className="text-sm text-ink-soft">다 하셨나요? 마지막 화면을 캡처해서 올려주세요.</p>
              <button
                type="button"
                onClick={() => setTab("gallery")}
                className="mt-3 rounded-full bg-mocha px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-mocha-deep"
              >
                인증하러 가기 →
              </button>
            </div>
          </div>
        ) : (
          // 갤러리는 카드가 여러 단으로 깔려야 해서 넓게
          <div className="mx-auto max-w-6xl px-6 py-7">
            <LabGallery
              sessionId={sessionId}
              slideNo={slide.slideNo}
              posts={mine}
              role={role}
              me={me}
              onRemove={remove}
              onLike={like}
            />
          </div>
        )}
      </div>
    </div>
  );
}
