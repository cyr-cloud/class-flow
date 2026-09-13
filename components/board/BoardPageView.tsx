"use client";

// 실습 게시판 한 개 화면.
// 노션처럼 리스트형 / 갤러리형을 토글하고, 그 선택을 게시판별로 기억한다.

import Link from "next/link";
import { useMemo, useState } from "react";
import { BoardView, Post } from "@/lib/types";
import { boardStore, useBoard, useBoardView, useClass, usePosts } from "@/lib/board/useBoard";
import { avatarClass, displayName, formatDate, initial, prettyUrl } from "@/lib/board/format";
import PostThumb from "./PostThumb";
import PostFormModal from "./PostFormModal";
import PostDetailModal from "./PostDetailModal";

type SortKey = "new" | "old" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  new: "최신순",
  old: "오래된순",
  name: "이름순",
};

export default function BoardPageView({
  classId,
  boardId,
}: {
  classId: string;
  boardId: string;
}) {
  const cls = useClass(classId);
  const board = useBoard(boardId);
  const posts = usePosts(boardId);

  const [view, changeView] = useBoardView(boardId);
  const [sort, setSort] = useState<SortKey>("new");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState<Post | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? posts.filter((p) =>
          [p.title, p.authorName, p.description].join(" ").toLowerCase().includes(q),
        )
      : posts;
    const sorted = [...filtered];
    if (sort === "old") sorted.sort((a, b) => a.createdAt - b.createdAt);
    else if (sort === "name")
      sorted.sort((a, b) =>
        displayName(a.authorName).localeCompare(displayName(b.authorName), "ko"),
      );
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [posts, query, sort]);

  // 상세 모달이 열려 있는 동안 원본이 수정/삭제되면 최신 내용으로 맞춰준다
  const detailPost = detail ? (posts.find((p) => p.id === detail.id) ?? null) : null;

  if (!board) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <p className="text-ink-soft">게시판을 찾을 수 없습니다.</p>
        <Link
          href={`/board/${classId}`}
          className="mt-4 inline-block text-sm text-mocha hover:underline"
        >
          실습 목록으로
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-14">
      <nav className="flex items-center gap-2 text-sm text-mute">
        <Link href={`/board/${classId}`} className="transition-colors hover:text-mocha">
          {cls?.title ?? "수업"}
        </Link>
        <span>/</span>
        <span className="text-ink-soft">실습 {board.no}</span>
      </nav>

      {editingTitle ? (
        <div className="mt-5 space-y-2">
          <input
            autoFocus
            defaultValue={board.title}
            onBlur={(e) => {
              boardStore.updateBoard(board.id, { title: e.target.value.trim() || board.title });
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="w-full rounded-xl border border-line-strong bg-paper px-4 py-2 text-3xl font-bold text-ink outline-none focus:border-mocha"
          />
          <input
            defaultValue={board.description}
            placeholder="실습 설명 (선택)"
            onBlur={(e) => boardStore.updateBoard(board.id, { description: e.target.value })}
            className="w-full rounded-xl border border-line-strong bg-paper px-4 py-2 text-sm text-ink-soft outline-none placeholder:text-mute focus:border-mocha"
          />
        </div>
      ) : (
        <div className="mt-5">
          <h1
            onClick={() => setEditingTitle(true)}
            title="클릭해서 이름 수정"
            className="cursor-text text-4xl font-bold text-ink"
          >
            {board.title}
          </h1>
          {board.description && <p className="mt-2 text-ink-soft">{board.description}</p>}
        </div>
      )}

      {/* 툴바 */}
      <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <div className="flex rounded-full border border-line-strong p-0.5">
          {(["list", "gallery"] as BoardView[]).map((v) => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                view === v ? "bg-ink text-white" : "text-ink-soft hover:text-mocha"
              }`}
            >
              {v === "list" ? "리스트" : "갤러리"}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-line-strong bg-transparent px-3 py-1.5 text-sm text-ink-soft outline-none focus:border-mocha"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색"
          className="w-28 rounded-full border border-line-strong bg-transparent px-4 py-1.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha sm:w-44"
        />

        <span className="ml-auto text-sm text-mute">{posts.length}개</span>

        <button
          onClick={() => setUploading(true)}
          className="rounded-full bg-ink px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
        >
          결과물 올리기
        </button>
      </div>

      {/* 본문 */}
      {visible.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-mute">
            {posts.length === 0 ? "아직 올라온 결과물이 없습니다." : "검색 결과가 없습니다."}
          </p>
          {posts.length === 0 && (
            <button
              onClick={() => setUploading(true)}
              className="mt-5 rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
            >
              첫 결과물 올리기
            </button>
          )}
        </div>
      ) : view === "gallery" ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <button
              key={post.id}
              onClick={() => setDetail(post)}
              className="group overflow-hidden rounded-2xl border border-line bg-paper text-left transition-colors hover:border-mocha"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-gardenia">
                <PostThumb imageKey={post.imageKey} title={post.title} />
              </div>
              <div className="px-4 py-4">
                <p className="truncate font-medium text-ink group-hover:text-mocha">
                  {post.title}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-mute">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${avatarClass(post.authorName)}`}
                  >
                    {initial(post.authorName)}
                  </span>
                  <span className="truncate">{displayName(post.authorName)}</span>
                  <span>·</span>
                  <span className="shrink-0">{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((post) => (
            <li key={post.id}>
              <button
                onClick={() => setDetail(post)}
                className="group flex w-full items-center gap-4 py-4 text-left"
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gardenia">
                  <PostThumb imageKey={post.imageKey} title={post.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink group-hover:text-mocha">
                    {post.title}
                  </p>
                  {post.description && (
                    <p className="truncate text-xs text-mute">{post.description}</p>
                  )}
                </div>
                {post.projectUrl && (
                  <span className="hidden shrink-0 text-xs text-mute sm:block">
                    {prettyUrl(post.projectUrl)}
                  </span>
                )}
                <span className="hidden w-24 shrink-0 truncate text-sm text-ink-soft sm:block">
                  {displayName(post.authorName)}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-mute">
                  {formatDate(post.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploading && <PostFormModal boardId={boardId} onClose={() => setUploading(false)} />}
      {detailPost && <PostDetailModal post={detailPost} onClose={() => setDetail(null)} />}
    </main>
  );
}
