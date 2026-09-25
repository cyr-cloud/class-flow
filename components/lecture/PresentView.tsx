"use client";

// 전체화면 발표 모드. 강사·학생이 같이 쓴다.
//
// 슬라이드는 화면에 꽉 채우되, 참여요소가 걸린 슬라이드에서는 옆(좁은 화면에서는 아래)에
// 패널을 띄운다 — 강사는 응답 현황을 보면서 진행하고, 학생은 전체화면에서도 답을 눌러야 한다.
//
// 브라우저 전체화면(Fullscreen API)이 막힌 환경에서도 오버레이만으로 동작한다.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { DeckSlide, LabPost, QuizResponse } from "@/lib/types";
import SlideStage from "./SlideStage";
import SlideActivities from "./SlideActivities";

const noSubscribe = () => () => {};
const emptyUrl = () => "";

export default function PresentView({
  sessionId,
  pdfKey,
  page,
  total,
  slide,
  posts,
  responses,
  role,
  reveal,
  onPrev,
  onNext,
  onToggleReveal,
  onClose,
}: {
  sessionId: string;
  pdfKey: string | null;
  page: number;
  total: number;
  slide: DeckSlide | null;
  posts: LabPost[];
  responses: QuizResponse[];
  role: "teacher" | "student";
  reveal: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onToggleReveal?: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // 사용자가 이 슬라이드에서 패널을 접었는지. 슬라이드를 넘기면 다시 열린다.
  const [closedFor, setClosedFor] = useState<number | null>(null);
  const [qrVisible, setQrVisible] = useState(true);
  const studentUrl = useSyncExternalStore(noSubscribe,
    useCallback(() => `${window.location.origin}/student/${sessionId}`, [sessionId]), emptyUrl);

  const isTeacher = role === "teacher";
  const hasActivity = Boolean(slide && (slide.items.length > 0 || slide.kind === "lab"));
  const panelOpen = hasActivity && closedFor !== (slide?.slideNo ?? -1);

  const close = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  // 브라우저 전체화면으로 들어가고, ESC 등으로 빠져나오면 발표 모드도 같이 닫는다
  useEffect(() => {
    const el = rootRef.current;
    void el?.requestFullscreen?.().catch(() => {
      /* 막혀 있으면 오버레이만으로 진행 */
    });

    const onChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  // 발표 중 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        close();
        return;
      }
      if ((e.target as HTMLElement | null)?.closest("button,a,select,[contenteditable=true]")) return;
      if (!isTeacher) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        onNext?.();
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onPrev?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, isTeacher, onNext, onPrev]);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-ink lg:flex-row">
      {isTeacher && studentUrl && <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
        {qrVisible && <div id="presentation-join-qr" className="w-36 rounded-xl border border-line bg-white p-2 text-center text-ink shadow-lg sm:w-44">
          <p className="pt-1 text-xs font-bold">스캔하고 수업 참여</p>
          <QRCodeSVG value={studentUrl} size={192} level="M" marginSize={4} className="h-auto w-full" role="img" aria-label="학생 입장 QR코드" />
          <p className="break-all px-1 pb-1 text-xs text-ink-soft">{sessionId}</p>
        </div>}
        <button type="button" aria-expanded={qrVisible} aria-controls="presentation-join-qr" onClick={() => setQrVisible(value => !value)} className="rounded-full border border-white/30 bg-ink px-4 py-2 text-sm text-white shadow-md hover:bg-mocha-deep">
          {qrVisible ? "QR 숨기기" : "QR 보기"}
        </button>
      </div>}
      {/* 슬라이드 무대.
          min-w-0이 없으면 패널을 접어 커진 캔버스 폭이 이 칸의 최소 폭이 되어,
          패널을 다시 열어도 칸이 줄지 않고 패널이 화면 오른쪽 밖으로 밀려난다. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 p-3">
          <SlideStage
            sessionId={sessionId}
            pdfKey={pdfKey}
            page={page}
            fit="contain"
            canDraw={isTeacher}
            className="h-full w-full"
          />
        </div>

        {/* 조작 바 */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-4 pt-1 text-white/80">
          {isTeacher ? (
            <>
              <button
                onClick={onPrev}
                disabled={page <= 1}
                className="rounded-full border border-white/25 px-4 py-2 text-sm transition-colors hover:border-white hover:text-white disabled:opacity-25"
              >
                ← 이전
              </button>
              <span className="tabular-nums text-sm text-white/60">
                {total ? `${page} / ${total}` : "–"}
              </span>
              <button
                onClick={onNext}
                disabled={!!total && page >= total}
                className="rounded-full border border-white/25 px-4 py-2 text-sm transition-colors hover:border-white hover:text-white disabled:opacity-25"
              >
                다음 →
              </button>
            </>
          ) : (
            <span className="tabular-nums text-sm text-white/60">
              {total ? `${page} / ${total}` : "대기 중"} · 강사님을 따라갑니다
            </span>
          )}

          {slide && (
            <span className="min-w-0 flex-1 truncate text-sm text-white/50">{slide.title}</span>
          )}

          {isTeacher && slide?.items.some(item => item.hasAnswer ?? item.answers.length > 0) && (
            <button
              onClick={onToggleReveal}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                reveal
                  ? "bg-tendril text-white"
                  : "border border-white/25 hover:border-white hover:text-white"
              }`}
            >
              {reveal ? "정답 숨기기" : "정답 공개"}
            </button>
          )}

          {hasActivity && (
            <button
              onClick={() => setClosedFor(panelOpen ? (slide?.slideNo ?? null) : null)}
              className="rounded-full border border-white/25 px-4 py-2 text-sm transition-colors hover:border-white hover:text-white"
            >
              {panelOpen ? "참여 패널 접기" : "참여 패널 열기"}
            </button>
          )}

          <button
            onClick={close}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            나가기 (ESC)
          </button>
        </div>
      </div>

      {/* 참여 패널 */}
      {panelOpen && (
        <aside className="max-h-[45vh] shrink-0 overflow-y-auto border-t border-line bg-cream p-4 lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0">
          <SlideActivities
            sessionId={sessionId}
            slide={slide}
            posts={posts}
            responses={responses}
            role={role}
            reveal={reveal}
          />
        </aside>
      )}
    </div>
  );
}
