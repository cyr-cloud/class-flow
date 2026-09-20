"use client";

// 학생용 화면.
// 강사가 넘긴 슬라이드를 자동으로 따라가고, 참여요소가 걸린 슬라이드에서는 직접 눌러 답한다.
// 실습 슬라이드에서는 그 실습의 게시판으로 바로 넘어갈 수 있다.

import Link from "next/link";
import { useCallback, useState } from "react";
import SlideStage from "./lecture/SlideStage";
import SlideActivities from "./lecture/SlideActivities";
import PresentView from "./lecture/PresentView";
import { useSync } from "@/lib/sync/useSync";
import { useCurrentSlide, useDeckState } from "@/lib/lecture/useDeck";
import LiveStatus from "./lecture/LiveStatus";

export default function StudentView({ sessionId }: { sessionId: string }) {
  const { state } = useSync(sessionId);
  const { responses, posts } = useDeckState(sessionId);
  const slide = useCurrentSlide(sessionId, state.currentSlide);
  const [presenting, setPresenting] = useState(false);
  const stopPresenting = useCallback(() => setPresenting(false), []);

  return (
    <div className="min-h-screen bg-cream">
      {/* 강사 화면과 같은 짜임 — 배지 + 진행 상황 + 큰 제목 */}
      <header className="sticky top-14 z-20 border-b border-line-strong bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-mocha px-2.5 py-1 text-xs font-semibold text-white">
                수업 참여
              </span>
              <span className="tabular-nums text-xs text-mute">
                {state.totalSlides ? `${state.currentSlide} / ${state.totalSlides}장` : "대기 중"}
              </span>
            </p>
            <h1 className="mt-2 truncate text-2xl font-bold leading-tight text-ink">
              {slide?.title ?? "강의를 기다리는 중"}
            </h1>
          </div>
          {state.pdfKey && (
            <button
              onClick={() => setPresenting(true)}
              className="ml-auto shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
            >
              전체화면
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <LiveStatus sessionId={sessionId} />
        {!state.pdfKey ? (
          // updatedAt이 0이면 이 코드로 열린 수업 자체가 없다는 뜻
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper text-center">
            {state.updatedAt === 0 ? (
              <>
                <p className="text-ink-soft">
                  <span className="font-mono text-ink">{sessionId}</span> — 이 코드로 열린 수업을
                  찾지 못했어요.
                </p>
                <p className="text-xs text-mute">코드를 다시 확인해 주세요.</p>
                <Link
                  href="/"
                  className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
                >
                  코드 다시 입력
                </Link>
              </>
            ) : (
              <p className="text-mute">강사님이 슬라이드를 준비 중이에요…</p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-paper p-3">
            <SlideStage
              sessionId={sessionId}
              pdfKey={state.pdfKey}
              page={state.currentSlide}
            />
          </div>
        )}

        <SlideActivities
          sessionId={sessionId}
          slide={slide}
          posts={posts}
          responses={responses}
          role="student"
          reveal={state.revealAnswer}
        />

        <p className="mt-6 text-center text-xs text-mute">
          화면은 강사님을 따라 자동으로 넘어가요.
        </p>
      </main>

      {presenting && (
        <PresentView
          sessionId={sessionId}
          pdfKey={state.pdfKey}
          page={state.currentSlide}
          total={state.totalSlides}
          slide={slide}
          posts={posts}
          responses={responses}
          role="student"
          reveal={state.revealAnswer}
          onClose={stopPresenting}
        />
      )}
    </div>
  );
}
