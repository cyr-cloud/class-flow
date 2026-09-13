"use client";

// 이 브라우저에서 만든 수업 목록 + 수업 만들기 / 코드로 들어가기.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { boardStore, useBoardData, useClasses } from "@/lib/board/useBoard";
import { formatDate } from "@/lib/board/format";

export default function ClassIndexView() {
  const router = useRouter();
  const classes = useClasses();
  const data = useBoardData();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");

  const create = () => {
    const cls = boardStore.createClass(title);
    setTitle("");
    router.push(`/board/${cls.id}`);
  };

  const enter = () => {
    const id = code.trim();
    if (id) router.push(`/board/${id}`);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <p className="eyebrow">Boards</p>
      <h1 className="mt-3 text-4xl font-bold text-ink">결과물 게시판</h1>
      <p className="mt-4 max-w-xl text-ink-soft">
        수업을 만들고 실습마다 게시판을 두면, 학생들이 가입 없이 결과물을 올릴 수 있습니다.
      </p>

      <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        <section className="bg-paper p-6">
          <p className="eyebrow">새로 만들기</p>
          <h2 className="mt-2 font-bold text-ink">수업 만들기</h2>
          <div className="mt-4 flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="수업 이름"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
            />
            <button
              onClick={create}
              className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
            >
              만들기
            </button>
          </div>
        </section>

        <section className="bg-paper p-6">
          <p className="eyebrow">이미 있는 수업</p>
          <h2 className="mt-2 font-bold text-ink">코드로 들어가기</h2>
          <div className="mt-4 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enter()}
              placeholder="수업 코드"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
            />
            <button
              onClick={enter}
              className="shrink-0 rounded-full border border-line-strong px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
            >
              입장
            </button>
          </div>
        </section>
      </div>

      <div className="mt-14 flex items-baseline justify-between border-b border-line pb-3">
        <p className="eyebrow">내 수업</p>
        <span className="text-sm text-mute">{classes.length}개</span>
      </div>

      {classes.length === 0 ? (
        <p className="py-16 text-center text-mute">아직 만든 수업이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line">
          {classes.map((cls) => {
            const boardCount = data.boards.filter((b) => b.classId === cls.id).length;
            return (
              <li key={cls.id}>
                <Link
                  href={`/board/${cls.id}`}
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-paper"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-ink group-hover:text-mocha">
                    {cls.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-mute">{cls.id}</span>
                  <span className="shrink-0 text-sm text-ink-soft">실습 {boardCount}개</span>
                  <span className="hidden w-20 shrink-0 text-right text-xs text-mute sm:block">
                    {formatDate(cls.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
