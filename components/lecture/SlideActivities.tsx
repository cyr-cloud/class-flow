"use client";

// 현재 슬라이드에 걸린 것들 — 실습 게시판 바로가기 + 참여요소 문항.
// 강사·학생 화면이 같은 컴포넌트를 쓰고, role로 조작 권한만 갈린다.

import { useState } from "react";
import { DeckSlide, LabPost, QuizResponse } from "@/lib/types";
import QuizItemCard from "./QuizItemCard";
import LabPanel from "./LabPanel";

export default function SlideActivities({
  sessionId,
  slide,
  posts,
  responses,
  role,
  reveal,
}: {
  sessionId: string;
  slide: DeckSlide | null;
  posts: LabPost[];
  responses: QuizResponse[];
  role: "teacher" | "student";
  reveal: boolean;
}) {
  const [openTab, setOpenTab] = useState<"guide" | "gallery" | null>(null);

  if (!slide) return null;

  const showLab = slide.kind === "lab";
  const postCount = posts.filter((p) => p.slideNo === slide.slideNo).length;

  // 퀴즈 슬라이드로 알아봤는데 문항이 비어 있으면, 교안을 안 올린 것이다.
  // 그냥 아무것도 안 뜨면 고장난 줄 알게 되므로 강사에게만 이유를 적어준다.
  const missingItems = slide.items.length === 0 && slide.kind === "quiz";
  const showHint = role === "teacher" && missingItems;

  if (!showLab && slide.items.length === 0 && !showHint) return null;

  return (
    <div className="mt-5 space-y-3">
      {showLab && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-2xl border border-mocha/30 bg-mocha-tint px-5 py-4">
          <span className="eyebrow text-mocha-deep">실습 {slide.labNo}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{slide.title}</span>
          {slide.guide && (
            <button
              type="button"
              onClick={() => setOpenTab("guide")}
              className="shrink-0 rounded-full border border-mocha px-4 py-2 text-sm font-medium text-mocha-deep transition-colors hover:bg-mocha hover:text-white"
            >
              실습가이드 보러가기
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenTab("gallery")}
            className="shrink-0 rounded-full bg-mocha px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
          >
            결과물 올리기{postCount > 0 && ` · ${postCount}`}
          </button>
        </div>
      )}

      {openTab && showLab && (
        <LabPanel
          sessionId={sessionId}
          slide={slide}
          posts={posts}
          role={role}
          startOn={openTab}
          onClose={() => setOpenTab(null)}
        />
      )}

      {showHint && (
        <p className="rounded-2xl border border-dashed border-line-strong bg-paper px-5 py-4 text-sm text-ink-soft">
          퀴즈 슬라이드로 보이는데 문항이 비어 있어요. 위{" "}
          <span className="font-medium text-ink">교안 불러오기</span> 로 교안 마크다운을 올리면
          이 슬라이드의 문항·선택지·정답이 채워집니다. (PDF에는 문항이 안 들어 있어요)
        </p>
      )}

      {slide.items.map((item) => (
        <QuizItemCard
          key={item.id}
          sessionId={sessionId}
          item={item}
          responses={responses}
          role={role}
          reveal={reveal}
        />
      ))}
    </div>
  );
}
