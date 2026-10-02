"use client";

// 강사 화면의 수업 제목. 기본은 올린 파일 이름이지만, 무슨 강의인지 강사가 직접 적을 수 있다.
// 적은 제목은 학생 화면·수업 PDF·백업 목록에도 쓰인다. 비워서 저장하면 파일 이름으로 돌아간다.

import { useState } from "react";

export const LESSON_TITLE_MAX = 60;

export default function LessonTitle({
  title,
  fallback,
  onSave,
}: {
  title: string | null | undefined;
  /** 제목을 적지 않았을 때 보여줄 파일 이름 */
  fallback: string;
  onSave: (title: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = title?.trim() || fallback;

  if (draft === null) {
    return (
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate text-2xl font-bold leading-tight text-ink">{shown}</h1>
        <button
          type="button"
          onClick={() => setDraft(title?.trim() ?? "")}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
        >
          제목 수정
        </button>
      </div>
    );
  }

  const save = () => {
    onSave(draft.trim());
    setDraft(null);
  };
  return (
    <form
      className="mt-2 flex min-w-0 flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        autoFocus
        value={draft}
        maxLength={LESSON_TITLE_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // 슬라이드 넘김 단축키(←/→)가 같이 먹지 않게 막는다
          e.stopPropagation();
          if (e.key === "Escape") setDraft(null);
        }}
        placeholder={fallback}
        aria-label="수업 제목"
        className="min-w-0 flex-1 rounded-xl border border-line-strong bg-cream px-3 py-2 text-lg font-bold text-ink outline-none focus:border-mocha sm:w-96 sm:flex-none"
      />
      <button type="submit" className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
        저장
      </button>
      <button type="button" onClick={() => setDraft(null)} className="shrink-0 rounded-full px-3 py-2 text-sm text-mute hover:bg-cream">
        취소
      </button>
    </form>
  );
}
