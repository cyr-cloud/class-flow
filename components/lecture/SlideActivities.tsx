"use client";

// 현재 슬라이드에 걸린 것들 — 실습 게시판 바로가기 + 참여요소 문항.
// 강사·학생 화면이 같은 컴포넌트를 쓰고, role로 조작 권한만 갈린다.

import Link from "next/link";
import { DeckSlide, QuizResponse } from "@/lib/types";
import QuizItemCard from "./QuizItemCard";

export default function SlideActivities({
  sessionId,
  slide,
  classId,
  responses,
  role,
  reveal,
}: {
  sessionId: string;
  slide: DeckSlide | null;
  classId: string | null;
  responses: QuizResponse[];
  role: "teacher" | "student";
  reveal: boolean;
}) {
  if (!slide) return null;

  const showLab = slide.kind === "lab";
  const boardHref = classId && slide.boardId ? `/board/${classId}/${slide.boardId}` : null;

  // 퀴즈 슬라이드로 알아봤는데 문항이 비어 있으면, 교안을 안 올린 것이다.
  // 그냥 아무것도 안 뜨면 고장난 줄 알게 되므로 강사에게만 이유를 적어준다.
  const missingItems = slide.items.length === 0 && (slide.kind === "quiz" || slide.kind === "lab");
  const showHint = role === "teacher" && missingItems;

  if (!showLab && slide.items.length === 0 && !showHint) return null;

  return (
    <div className="mt-5 space-y-3">
      {showLab && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-mocha/30 bg-mocha-tint px-5 py-4">
          <span className="eyebrow text-mocha-deep">실습 {slide.labNo}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{slide.title}</span>
          {boardHref ? (
            <Link
              href={boardHref}
              className="shrink-0 rounded-full bg-mocha px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
            >
              결과물 올리러 가기 →
            </Link>
          ) : (
            <span className="shrink-0 text-xs text-mocha-deep">
              {role === "teacher" ? "게시판이 아직 연결되지 않았어요" : "게시판 준비 중이에요"}
            </span>
          )}
        </div>
      )}

      {showHint && (
        <p className="rounded-2xl border border-dashed border-line-strong bg-paper px-5 py-4 text-sm text-ink-soft">
          {slide.kind === "quiz" ? "퀴즈 슬라이드로 보이는데 " : ""}문항이 비어 있어요. 위{" "}
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
