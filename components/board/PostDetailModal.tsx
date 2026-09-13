"use client";

// 결과물 상세 보기. 올린 사람(같은 브라우저)만 수정/삭제 버튼이 보인다.

import { useState } from "react";
import { Post } from "@/lib/types";
import { boardStore, useOwnerId } from "@/lib/board/useBoard";
import { avatarClass, displayName, formatDate, initial, prettyUrl } from "@/lib/board/format";
import Modal from "./Modal";
import PostThumb from "./PostThumb";
import PostFormModal from "./PostFormModal";

export default function PostDetailModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const ownerId = useOwnerId();
  const [editing, setEditing] = useState(false);
  const mine = ownerId !== "" && ownerId === post.ownerId;

  if (editing) {
    return (
      <PostFormModal
        boardId={post.boardId}
        post={post}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
      />
    );
  }

  const remove = () => {
    if (!window.confirm("이 결과물을 삭제할까요?")) return;
    boardStore.deletePost(post.id);
    onClose();
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{post.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-mute">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${avatarClass(post.authorName)}`}
            >
              {initial(post.authorName)}
            </span>
            <span>{displayName(post.authorName)}</span>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-mute hover:bg-gardenia hover:text-ink-soft"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="px-5 py-5">
        {post.imageKey && (
          <div className="mb-4 rounded-xl border border-line bg-gardenia">
            <PostThumb
              imageKey={post.imageKey}
              title={post.title}
              fit="contain"
              className="max-h-[60vh]"
            />
          </div>
        )}

        {post.projectUrl && (
          <a
            href={post.projectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
          >
            🔗 {prettyUrl(post.projectUrl)}
          </a>
        )}

        {post.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {post.description}
          </p>
        )}

        {!post.imageKey && !post.description && !post.projectUrl && (
          <p className="text-sm text-mute">내용이 없습니다.</p>
        )}
      </div>

      {mine && (
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            onClick={remove}
            className="rounded-full border border-line-strong px-4 py-2 text-sm text-rosetan hover:bg-rosetan/10"
          >
            삭제
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft hover:bg-gardenia"
          >
            수정
          </button>
        </div>
      )}
    </Modal>
  );
}
