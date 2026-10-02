"use client";

// 학생 화면 상단의 «실습 게시판» — 이 수업의 실습을 한곳에 모아 둔다.
//
// 학생 화면은 강사가 띄운 슬라이드를 따라가서, 강사가 다음으로 넘어가면 앞 실습의
// 갤러리로 갈 길이 없어진다. 늦게 끝낸 학생도 올릴 수 있고, 수업이 끝난 뒤 같은
// 주소로 다시 들어온 학생도 결과물을 볼 수 있게 슬라이드와 무관하게 열어 둔다.

import { useState } from "react";
import { createPortal } from "react-dom";
import { DeckSlide, LabPost } from "@/lib/types";
import { useLabSlides } from "@/lib/lecture/useDeck";
import Modal from "../board/Modal";
import LabPanel from "./LabPanel";

export default function LabBoardButton({
  sessionId,
  posts,
  currentSlide,
}: {
  sessionId: string;
  posts: LabPost[];
  currentSlide: number;
}) {
  const labs = useLabSlides(sessionId);
  const [listOpen, setListOpen] = useState(false);
  const [open, setOpen] = useState<DeckSlide | null>(null);

  if (labs.length === 0) return null;
  // 가이드가 고쳐지면 열려 있는 화면에도 반영되게 최신 슬라이드를 다시 찾는다
  const opened = open && (labs.find((s) => s.slideNo === open.slideNo) ?? open);

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        className="rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-mocha hover:text-mocha"
      >
        실습 게시판 · {labs.length}
      </button>

      {/* 상단 바(sticky)가 자기 층을 만들어서, 그 안에 두면 앱 헤더 밑에 깔린다 — body에 붙인다 */}
      {listOpen && !opened && createPortal(
        <Modal onClose={() => setListOpen(false)}>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-ink">실습 게시판</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  지난 실습도 여기서 가이드를 다시 보고 결과물을 올릴 수 있어요.
                </p>
              </div>
              <button
                type="button"
                aria-label="실습 게시판 닫기"
                onClick={() => setListOpen(false)}
                className="h-9 w-9 shrink-0 rounded-full border border-line text-xl text-ink-soft hover:bg-gardenia"
              >
                ×
              </button>
            </div>
            <ul className="mt-5 space-y-2">
              {labs.map((lab) => {
                const count = posts.filter((p) => p.slideNo === lab.slideNo).length;
                const now = lab.slideNo === currentSlide;
                return (
                  <li key={lab.slideNo}>
                    <button
                      type="button"
                      onClick={() => setOpen(lab)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line bg-cream px-4 py-3 text-left transition-colors hover:border-mocha"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mocha-tint text-sm font-bold text-mocha-deep">
                        {lab.labNo}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{lab.title}</span>
                        <span className="mt-0.5 block text-xs text-mute">
                          결과물 {count}개{lab.guide ? " · 가이드 있음" : ""}
                        </span>
                      </span>
                      {now && (
                        <span className="shrink-0 rounded-full bg-mocha px-2.5 py-1 text-xs font-semibold text-white">
                          지금 진행 중
                        </span>
                      )}
                      <span aria-hidden className="shrink-0 text-mute">→</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Modal>,
        document.body,
      )}

      {opened && createPortal(
        <LabPanel
          sessionId={sessionId}
          slide={opened}
          posts={posts}
          role="student"
          startOn="gallery"
          onClose={() => setOpen(null)}
        />,
        document.body,
      )}
    </>
  );
}
