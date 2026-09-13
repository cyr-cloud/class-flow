"use client";

// 결과물 올리기 / 수정 폼.
// 이미지는 파일 선택 · 드래그앤드롭 · 붙여넣기(Ctrl+V) 셋 다 받는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { Post } from "@/lib/types";
import { boardStore, useImageUrl, useRememberedName } from "@/lib/board/useBoard";
import { putBlob } from "@/lib/store/blobStore";
import { compressImage } from "@/lib/board/image";
import { normalizeUrl } from "@/lib/board/format";
import Modal from "./Modal";

function imageKeyFor(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `img_${rand}`;
}

export default function PostFormModal({
  boardId,
  post,
  onClose,
}: {
  boardId: string;
  /** 있으면 수정 모드 */
  post?: Post;
  onClose: () => void;
}) {
  const editing = Boolean(post);
  const [rememberedName, rememberName] = useRememberedName();

  // 새 글이면 지난번에 쓴 이름을 미리 채운다. 수정 중이면 원래 이름 그대로.
  const [name, setName] = useState(post ? post.authorName : rememberedName);
  const [title, setTitle] = useState(post?.title ?? "");
  const [description, setDescription] = useState(post?.description ?? "");
  const [projectUrl, setProjectUrl] = useState(post?.projectUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 이미지 상태: 기존 이미지 유지 / 새 이미지 선택 / 제거
  const existingUrl = useImageUrl(editing ? (post?.imageKey ?? null) : null);
  const [newImage, setNewImage] = useState<Blob | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const previewUrl = newImageUrl ?? (removed ? null : existingUrl);

  const pickImage = useCallback(async (file: File) => {
    setError("");
    try {
      const blob = await compressImage(file);
      setNewImage(blob);
      setNewImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setRemoved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지를 불러오지 못했습니다.");
    }
  }, []);

  // 붙여넣기로 스크린샷 바로 올리기
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? [])[0];
      if (file?.type.startsWith("image/")) {
        e.preventDefault();
        void pickImage(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pickImage]);

  useEffect(() => {
    return () => {
      if (newImageUrl) URL.revokeObjectURL(newImageUrl);
    };
  }, [newImageUrl]);

  const clearImage = () => {
    setNewImage(null);
    setNewImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoved(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let imageKey: string | null = editing ? (post?.imageKey ?? null) : null;
      if (newImage) {
        imageKey = imageKeyFor();
        await putBlob("images", imageKey, newImage);
      } else if (removed) {
        imageKey = null;
      }

      const payload = {
        authorName: name,
        title,
        description,
        imageKey,
        projectUrl: projectUrl ? normalizeUrl(projectUrl) : null,
      };

      if (editing && post) boardStore.updatePost(post.id, payload);
      else boardStore.createPost(boardId, payload);

      rememberName(name.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">
          {editing ? "결과물 수정" : "결과물 올리기"}
        </h2>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-mute hover:bg-gardenia hover:text-ink-soft"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-mute">이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="비워두면 익명"
              className="mt-1 w-full rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink outline-none focus:border-mocha"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-mute">
              제목 <span className="text-mocha">*</span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 계산기 만들기"
              className="mt-1 w-full rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink outline-none focus:border-mocha"
            />
          </label>
        </div>

        <div>
          <span className="text-xs font-medium text-mute">이미지</span>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void pickImage(file);
            }}
            className="mt-1"
          >
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-line bg-gardenia">
                {/* 로컬 blob URL이라 next/image 최적화 대상이 아니다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="미리보기" className="max-h-72 w-full object-contain" />
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full bg-paper/90 px-2 py-1 text-xs shadow hover:bg-paper"
                  >
                    변경
                  </button>
                  <button
                    onClick={clearImage}
                    className="rounded-full bg-paper/90 px-2 py-1 text-xs shadow hover:bg-paper"
                  >
                    제거
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-line-strong py-10 text-sm text-mute hover:border-mocha hover:bg-gardenia"
              >
                <span className="text-2xl">🖼️</span>
                <span className="mt-2">클릭해서 선택 · 드래그앤드롭 · Ctrl+V 붙여넣기</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickImage(file);
            }}
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-mute">링크 (선택)</span>
          <input
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            placeholder="결과물 주소 (예: github.com/...)"
            className="mt-1 w-full rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink outline-none focus:border-mocha"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-mute">설명 (선택)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="어떻게 만들었는지, 어려웠던 점 등"
            className="mt-1 w-full resize-y rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink outline-none focus:border-mocha"
          />
        </label>

        {error && <p className="text-sm text-rosetan">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <button
          onClick={onClose}
          className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft hover:bg-gardenia"
        >
          취소
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-mocha-deep disabled:opacity-50"
        >
          {busy ? "저장 중…" : editing ? "저장" : "올리기"}
        </button>
      </div>
    </Modal>
  );
}
