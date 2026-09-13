"use client";

// 수업 하나의 실습 게시판 목록.
// 수업 하나에 실습이 20개쯤 되므로, 한 번에 여러 개 만드는 버튼을 같이 둔다.

import Link from "next/link";
import { useState } from "react";
import { boardStore, useBoards, useClass } from "@/lib/board/useBoard";
import { formatDate } from "@/lib/board/format";

export default function ClassPageView({ classId }: { classId: string }) {
  const cls = useClass(classId);
  const boards = useBoards(classId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [bulk, setBulk] = useState(20);
  const [copied, setCopied] = useState(false);

  if (!cls) {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-24 text-center">
        <p className="eyebrow">Not found</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">이 브라우저에 없는 수업입니다</h1>
        <p className="mt-4 text-sm text-ink-soft">
          지금은 데이터가 각 브라우저 안에만 저장돼서, 다른 기기에서 만든 수업은 보이지 않습니다.
          여기서 같은 코드(<span className="font-mono text-ink">{classId}</span>)로 새로 만들 수
          있습니다.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => boardStore.createClass("새 수업", classId)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
          >
            이 코드로 수업 만들기
          </button>
          <Link
            href="/board"
            className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
          >
            내 수업 목록
          </Link>
        </div>
      </main>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한이 없으면 무시 */
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <nav className="text-sm text-mute">
        <Link href="/board" className="transition-colors hover:text-mocha">
          내 수업
        </Link>
      </nav>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={cls.title}
            onBlur={(e) => {
              boardStore.updateClass(cls.id, { title: e.target.value.trim() || cls.title });
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="flex-1 rounded-xl border border-line-strong bg-paper px-4 py-2 text-3xl font-bold text-ink outline-none focus:border-mocha"
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            title="클릭해서 이름 수정"
            className="cursor-text text-4xl font-bold text-ink"
          >
            {cls.title}
          </h1>
        )}

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gardenia px-3 py-1.5 font-mono text-sm text-ink-soft">
            {cls.id}
          </span>
          <button
            onClick={copyLink}
            className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
          >
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <p className="eyebrow">실습 게시판</p>
        <span className="text-sm text-mute">{boards.length}개</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => boardStore.createBoard(classId)}
            className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
          >
            + 실습 추가
          </button>
          <div className="flex items-center gap-1 rounded-full border border-line-strong px-3 py-1.5">
            <input
              type="number"
              min={1}
              max={50}
              value={bulk}
              onChange={(e) => setBulk(Number(e.target.value))}
              className="w-9 bg-transparent text-sm text-ink outline-none"
            />
            <button
              onClick={() => boardStore.createBoards(classId, Math.min(50, Math.max(1, bulk)))}
              className="text-sm text-ink-soft transition-colors hover:text-mocha"
            >
              개 한 번에 만들기
            </button>
          </div>
        </div>
      </div>

      {boards.length === 0 ? (
        <p className="py-20 text-center text-mute">
          아직 실습 게시판이 없습니다. 위에서 만들어 주세요.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {boards.map(({ board, postCount }) => (
            <li key={board.id} className="group flex items-center">
              <Link
                href={`/board/${classId}/${board.id}`}
                className="flex flex-1 items-center gap-4 py-4"
              >
                <span className="w-8 shrink-0 text-sm tabular-nums text-mute">{board.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink group-hover:text-mocha">
                    {board.title}
                  </span>
                  {board.description && (
                    <span className="block truncate text-xs text-mute">{board.description}</span>
                  )}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs tabular-nums ${
                    postCount > 0 ? "bg-mocha/15 text-mocha-deep" : "bg-gardenia text-mute"
                  }`}
                >
                  {postCount}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-xs text-mute sm:block">
                  {formatDate(board.createdAt)}
                </span>
              </Link>
              <button
                onClick={() => {
                  if (window.confirm(`"${board.title}" 게시판과 올라온 결과물을 모두 삭제할까요?`))
                    boardStore.deleteBoard(board.id);
                }}
                className="ml-2 rounded-full px-2 py-1 text-sm text-transparent transition-colors hover:bg-rosetan/15 hover:text-rosetan group-hover:text-line-strong"
                aria-label="게시판 삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-14 text-xs text-mute">
        지금은 결과물이 이 브라우저 안에만 저장됩니다. 여러 기기에서 함께 쓰려면 Supabase 연결이
        필요합니다.
      </p>
    </main>
  );
}
