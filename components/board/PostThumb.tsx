"use client";

// 결과물 썸네일. 이미지가 없으면 제목 첫 글자로 만든 색 블록을 보여준다.

import { useImageUrl } from "@/lib/board/useBoard";
import { avatarClass, initial } from "@/lib/board/format";

export default function PostThumb({
  imageKey,
  title,
  className = "",
  fit = "cover",
}: {
  imageKey: string | null;
  title: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const url = useImageUrl(imageKey);

  if (imageKey && url) {
    return (
      // 로컬 blob URL이라 next/image 최적화 대상이 아니다
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title}
        className={
          fit === "cover"
            ? `h-full w-full object-cover ${className}`
            : `w-full object-contain ${className}`
        }
      />
    );
  }

  if (imageKey && !url) {
    // IndexedDB에서 읽어오는 중
    return <div className={`h-full w-full animate-pulse bg-gardenia ${className}`} />;
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${avatarClass(title)} ${className}`}
    >
      <span className="text-lg font-semibold">{initial(title)}</span>
    </div>
  );
}
