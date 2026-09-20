"use client";

// 지금 열려 있는 수업의 실습 게시판 모아보기.
//
// 결과물은 수업 안에 담겨 있어서(LiveState.posts) 수업을 거치지 않고는 볼 수 없다.
// 상단 「결과물 게시판」으로 들어왔을 때 빈 화면이 아니라 이 수업의 실습들이 보이게 한다.

import Link from "next/link";
import { useState } from "react";
import { useLastSession } from "@/lib/lastSession";
import { useDeckState } from "@/lib/lecture/useDeck";
import { DeckSlide } from "@/lib/types";
import LabPanel from "./lecture/LabPanel";

export default function SessionBoards() {
  const sessionId = useLastSession();
  const { deck, posts } = useDeckState(sessionId);
  const [open, setOpen] = useState<DeckSlide | null>(null);

  const labs = (deck?.slides ?? [])
    .filter((s) => s.kind === "lab")
    .sort((a, b) => (a.labNo ?? 0) - (b.labNo ?? 0));

  if (!sessionId || labs.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <p className="eyebrow">결과물 게시판</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">아직 열린 실습이 없어요</h1>
        <p className="mt-3 text-ink-soft">
          결과물 게시판은 수업 안의 실습마다 하나씩 붙습니다. 강의를 열고 슬라이드를
          불러오면 여기에 모여요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
        >
          강의 열러 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="eyebrow">결과물 게시판</p>
      <h1 className="mt-3 text-3xl font-bold text-ink">실습 {labs.length}개</h1>
      <p className="mt-2 text-ink-soft">
        세션 <span className="font-mono text-ink">{sessionId}</span> 의 실습입니다. 실습을 누르면
        안내문과 올라온 결과물을 볼 수 있어요.
      </p>

      <ul className="mt-9 grid gap-4 sm:grid-cols-2">
        {labs.map((lab) => {
          const count = posts.filter((p) => p.slideNo === lab.slideNo).length;
          return (
            <li key={lab.slideNo}>
              <button
                onClick={() => setOpen(lab)}
                className="flex w-full items-center gap-4 rounded-2xl border border-line bg-paper px-5 py-5 text-left transition-colors hover:border-mocha"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mocha-tint text-sm font-bold text-mocha-deep">
                  {lab.labNo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{lab.title}</span>
                  <span className="mt-1 block text-xs text-mute">
                    결과물 {count}개{lab.guide ? " · 안내문 있음" : ""}
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-mute">→</span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <LabPanel
          sessionId={sessionId}
          slide={open}
          posts={posts}
          role="student"
          startOn={open.guide ? "guide" : "gallery"}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}
