"use client";

// 실습 결과물 갤러리.
// 기존 실습 게시판(components/board/BoardPageView)과 같은 형태로 보여준다 —
// 리스트형/갤러리형 토글, 카드 그리드, 상세는 모달. 올리기도 모달이라 목록이 밀리지 않는다.
//
// 결과물에는 제목이 따로 없다. 그래서 카드의 머리글 자리는 올린 사람 이름이 맡는다
// — 누가 올렸는지가 이 화면에서 제일 먼저 보여야 하는 정보다.

import { useMemo, useState } from "react";
import Image from "next/image";
import { BoardView, LabPost } from "@/lib/types";
import { avatarClass, displayName, formatDate, initial } from "@/lib/board/format";
import Modal from "../board/Modal";
import LabPostForm from "./LabPostForm";

function Thumb({ post }: { post: LabPost }) {
  if (!post.imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs leading-5 text-mute">
        {post.description.slice(0, 60) || "글로만 올린 결과물"}
      </div>
    );
  }
  return (
    <Image
      src={post.imageUrl}
      alt=""
      width={800}
      height={600}
      unoptimized
      className="h-full w-full object-cover"
    />
  );
}

/** 올린 사람 — 결과물에는 제목이 없으니 이 자리가 카드의 머리글이다 */
function Author({ post, big = false }: { post: LabPost; big?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-bold ${avatarClass(post.authorName)} ${
          big ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
        }`}
      >
        {initial(post.authorName)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-semibold text-ink ${big ? "text-lg" : "text-[15px]"}`}>
            {displayName(post.authorName)}
          </span>
          {post.createdAt === 0 && (
            <span className="shrink-0 rounded-full bg-mocha-tint px-2 py-0.5 text-[10px] font-medium text-mocha-deep">
              예시
            </span>
          )}
        </span>
        <span className="block text-xs text-mute">
          {post.createdAt === 0 ? "강사가 미리 올려둔 것" : formatDate(post.createdAt)}
        </span>
      </span>
    </div>
  );
}

function LikeButton({
  post,
  me,
  onLike,
}: {
  post: LabPost;
  me: string;
  onLike: (postId: string) => void;
}) {
  const likes = post.likes ?? [];
  const liked = likes.includes(me);
  return (
    <button
      type="button"
      onClick={() => onLike(post.id)}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors ${
        liked
          ? "border-rosetan bg-rosetan/10 text-rosetan"
          : "border-line-strong text-mute hover:border-rosetan hover:text-rosetan"
      }`}
    >
      <Heart filled={liked} />
      {likes.length > 0 && likes.length}
    </button>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={filled ? 0 : 1.6}>
      <path d="M10 17s-6.2-3.9-6.2-8.1A3.7 3.7 0 0 1 10 6.3a3.7 3.7 0 0 1 6.2 2.6c0 4.2-6.2 8.1-6.2 8.1Z" />
    </svg>
  );
}

export default function LabGallery({
  sessionId,
  slideNo,
  posts,
  role,
  me,
  onRemove,
  onLike,
}: {
  sessionId: string;
  slideNo: number;
  posts: LabPost[];
  role: "teacher" | "student";
  me: string;
  onRemove: (postId: string) => void;
  onLike: (postId: string) => void;
}) {
  const [view, setView] = useState<BoardView>("gallery");
  const [uploading, setUploading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 강사 예시를 맨 앞에 두고, 그 뒤로 새로 올라온 것부터
  const ordered = useMemo(
    () =>
      [...posts].sort((a, b) =>
        a.createdAt === 0 ? -1 : b.createdAt === 0 ? 1 : b.createdAt - a.createdAt,
      ),
    [posts],
  );
  const detail = detailId ? (ordered.find((p) => p.id === detailId) ?? null) : null;
  const canRemove = (post: LabPost) =>
    post.createdAt !== 0 && (role === "teacher" || post.ownerId === me);

  return (
    <>
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <div className="flex rounded-full border border-line-strong p-0.5">
          {(["list", "gallery"] as BoardView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                view === v ? "bg-ink text-white" : "text-ink-soft hover:text-mocha"
              }`}
            >
              {v === "list" ? "리스트" : "갤러리"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-mute">{ordered.length}개</span>

        <button
          onClick={() => setUploading(true)}
          className="rounded-full bg-ink px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
        >
          결과물 올리기
        </button>
      </div>

      {view === "gallery" ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((post) => (
            <article
              key={post.id}
              className={`flex flex-col overflow-hidden rounded-2xl border bg-paper ${
                post.createdAt === 0 ? "border-mocha/40" : "border-line"
              }`}
            >
              <button
                onClick={() => setDetailId(post.id)}
                className="group block text-left"
                aria-label="결과물 크게 보기"
              >
                <span className="block aspect-[4/3] w-full overflow-hidden bg-gardenia">
                  <Thumb post={post} />
                </span>
              </button>
              <div className="flex flex-1 flex-col px-4 py-4">
                <Author post={post} />
                <button
                  onClick={() => setDetailId(post.id)}
                  className="mt-2.5 flex-1 text-left"
                >
                  <p className="line-clamp-3 text-sm leading-6 text-ink-soft hover:text-ink">
                    {post.description || "설명 없음"}
                  </p>
                </button>
                <div className="mt-3 flex items-center">
                  <LikeButton post={post} me={me} onLike={onLike} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {ordered.map((post) => (
            <li key={post.id} className="flex items-center gap-4 py-4">
              <button
                onClick={() => setDetailId(post.id)}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gardenia"
                aria-label="결과물 크게 보기"
              >
                <Thumb post={post} />
              </button>
              <div className="min-w-0 flex-1">
                <Author post={post} />
                <button onClick={() => setDetailId(post.id)} className="mt-1 block w-full text-left">
                  <p className="truncate text-sm text-ink-soft hover:text-ink">
                    {post.description || "설명 없음"}
                  </p>
                </button>
              </div>
              <LikeButton post={post} me={me} onLike={onLike} />
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <Modal onClose={() => setUploading(false)}>
          <LabPostForm
            sessionId={sessionId}
            slideNo={slideNo}
            me={me}
            onDone={() => setUploading(false)}
          />
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetailId(null)} size="lg">
          <div className="overflow-hidden rounded-2xl">
            {detail.imageUrl && (
              <Image
                src={detail.imageUrl}
                alt=""
                width={1400}
                height={1000}
                unoptimized
                className="max-h-[68vh] w-full bg-gardenia object-contain"
              />
            )}
            <div className="px-6 py-5">
              <div className="flex items-center gap-3">
                <Author post={detail} big />
                <span className="ml-auto">
                  <LikeButton post={detail} me={me} onLike={onLike} />
                </span>
              </div>
              {detail.description && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">
                  {detail.description}
                </p>
              )}
              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={() => setDetailId(null)}
                  className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
                >
                  닫기
                </button>
                {canRemove(detail) && (
                  <button
                    onClick={() => {
                      onRemove(detail.id);
                      setDetailId(null);
                    }}
                    className="ml-auto text-sm text-mute transition-colors hover:text-rosetan"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
