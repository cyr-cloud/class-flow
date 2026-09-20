"use client";

// 실습 결과물 올리기 (모달 안에 들어간다).
// 이미지는 브라우저에서 먼저 줄여서 올린다 — 스마트폰 캡처는 그대로 두면 몇 MB라
// 공유 저장소에 넣기엔 너무 크다.

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { liveClient } from "@/lib/live/client";
import { compressImage } from "@/lib/board/image";

export default function LabPostForm({
  sessionId,
  slideNo,
  me,
  onDone,
}: {
  sessionId: string;
  slideNo: number;
  me: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const file = attachment?.file ?? null;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const pickImage = useCallback((image: File) => {
    if (!image.type.startsWith("image/")) {
      setError("이미지 파일을 선택해 주세요.");
      return;
    }
    setError("");
    setAttachment({ file: image, preview: URL.createObjectURL(image) });
  }, []);

  useEffect(() => {
    return () => { if (attachment) URL.revokeObjectURL(attachment.preview); };
  }, [attachment]);

  // Only listen while this result form is mounted. Plain text still pastes normally.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      const image = Array.from(data?.files ?? []).find((item) => item.type.startsWith("image/"))
        ?? Array.from(data?.items ?? []).find((item) => item.type.startsWith("image/"))?.getAsFile();
      if (!image) return;
      event.preventDefault();
      if (!busy) pickImage(image);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, pickImage]);

  const submit = useCallback(async () => {
    setError("");
    if (!description.trim() && !file) {
      setError("무엇을 했는지 한 줄 적거나, 화면 캡처를 올려주세요.");
      return;
    }
    try {
      let imageUrl: string | null = null;
      if (file) {
        setBusy("이미지 줄이는 중…");
        const blob = await compressImage(file);
        setBusy("올리는 중…");
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/webp" },
          body: blob,
        });
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) throw new Error(body.error ?? "이미지를 올리지 못했어요.");
        imageUrl = body.url;
      }
      setBusy("저장하는 중…");
      await liveClient(sessionId).send({
        action: "addPost",
        slideNo,
        authorName: name,
        description,
        imageUrl,
        ownerId: me,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy("");
    }
  }, [description, file, me, name, onDone, sessionId, slideNo]);

  return (
    <div className="px-6 py-6">
      <p className="eyebrow text-mute">결과물 올리기</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 (비우면 익명)"
          disabled={busy !== ""}
          className="w-44 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
        />
        <label className="cursor-pointer rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha">
          {file ? `${file.name.slice(0, 22)} 선택됨` : "화면 캡처 고르기"}
          <input
            type="file"
            accept="image/*"
            disabled={busy !== ""}
            className="hidden"
            onChange={(e) => {
              const image = e.target.files?.[0];
              if (image) pickImage(image);
              e.target.value = "";
            }}
          />
        </label>
        {file && (
          <button
            type="button"
            onClick={() => setAttachment(null)}
            disabled={busy !== ""}
            className="rounded-xl px-3 py-2.5 text-sm text-mute hover:text-rosetan"
          >
            빼기
          </button>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-mute">
        캡처한 이미지를 Ctrl+V로 바로 붙여넣으세요. Mac은 ⌘V를 사용하세요.
        {file && " 다른 이미지를 붙여넣으면 첨부 이미지가 교체됩니다."}
      </p>
      {attachment && (
        <figure className="mt-3 overflow-hidden rounded-xl border border-line bg-cream p-2">
          <Image src={attachment.preview} alt="첨부할 화면 캡처 미리보기" width={800} height={450}
            unoptimized className="max-h-52 w-full object-contain" />
          <figcaption role="status" className="mt-2 text-xs text-ink-soft">이미지 1장 첨부됨 · ‘올리기’를 누르면 공유됩니다.</figcaption>
        </figure>
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        disabled={busy !== ""}
        placeholder="무엇을 시켰고 어디서 막혔는지 한두 줄 적어주세요."
        className="mt-2 w-full resize-y rounded-xl border border-line bg-cream px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-mute focus:border-mocha"
      />

      {error && <p className="mt-2 text-sm text-rosetan">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy !== ""}
          className="rounded-full bg-mocha px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-40"
        >
          {busy || "올리기"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy !== ""}
          className="rounded-full border border-line-strong px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-40"
        >
          취소
        </button>
      </div>
    </div>
  );
}
