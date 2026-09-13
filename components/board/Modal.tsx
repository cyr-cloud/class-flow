"use client";

import { useEffect } from "react";

/** 게시판에서 쓰는 공통 모달 셸. ESC 닫기 + 배경 스크롤 잠금. */
export default function Modal({
  onClose,
  children,
  size = "md",
}: {
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`my-auto w-full rounded-2xl bg-paper shadow-xl ${
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
