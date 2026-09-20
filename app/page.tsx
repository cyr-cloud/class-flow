"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  const newSession = () => {
    router.push(`/teacher/${Math.random().toString(36).slice(2, 8)}`);
  };

  const join = () => {
    const id = sessionId.trim();
    if (id) router.push(`/student/${id}`);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <p className="eyebrow">ClassFlow</p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.15] text-ink sm:text-5xl">
        아직도 수업 때
        <br />
        <span className="text-mocha">보여주기만</span> 하시나요?
      </h1>
      <p className="mt-5 max-w-xl text-lg font-medium text-ink-soft">
        학생과 한 화면으로 소통하면서 수업해보세요.
      </p>
      <p className="mt-3 max-w-xl text-ink-soft">
        강사가 넘기면 학생 화면도 따라오고, 퀴즈 슬라이드에서는 그 자리에서 눌러 답합니다. 실습마다
        게시판이 하나씩 붙어 결과물이 쌓입니다.
      </p>

      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        <section className="flex flex-col bg-paper p-6">
          <p className="eyebrow">강사</p>
          <h2 className="mt-2 text-lg font-bold text-ink">강의 열기</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            PPT를 올리면 제목에서 실습·퀴즈 슬라이드를 찾아냅니다. 샘플로 1분 만에 체험해 보셔도
            됩니다.
          </p>
          <button
            onClick={newSession}
            className="mt-6 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
          >
            새 강의 시작
          </button>
        </section>

        <section className="flex flex-col bg-paper p-6">
          <p className="eyebrow">학생</p>
          <h2 className="mt-2 text-lg font-bold text-ink">수업 참여</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            강사님이 준 코드로 들어오면 화면이 자동으로 따라옵니다.
          </p>
          <div className="mt-6 flex gap-2">
            <input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="세션 코드"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
            />
            <button
              onClick={join}
              className="shrink-0 rounded-full border border-line-strong px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
            >
              입장
            </button>
          </div>
        </section>

        <section className="flex flex-col bg-paper p-6">
          <p className="eyebrow">모두</p>
          <h2 className="mt-2 text-lg font-bold text-ink">결과물 게시판</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            실습마다 게시판 하나. 가입 없이 올리고, 이름은 비우면 익명으로 올라갑니다.
          </p>
          <Link
            href="/board"
            className="mt-6 rounded-full border border-line-strong px-4 py-2.5 text-center text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
          >
            게시판 열기
          </Link>
        </section>
      </div>
    </main>
  );
}
