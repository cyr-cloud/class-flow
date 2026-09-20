"use client";

// 실습 결과물 올리기 (모달 안에 들어간다).
// 이미지는 브라우저에서 먼저 줄여서 올린다 — 스마트폰 캡처는 그대로 두면 몇 MB라
// 공유 저장소에 넣기엔 너무 크다.

import { useCallback, useState } from "react";
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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
          className="w-44 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
        />
        <label className="cursor-pointer rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha">
          {file ? `${file.name.slice(0, 22)} 선택됨` : "화면 캡처 고르기"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <button
            type="button"
            onClick={() => setFile(null)}
            className="rounded-xl px-3 py-2.5 text-sm text-mute hover:text-rosetan"
          >
            빼기
          </button>
        )}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
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
