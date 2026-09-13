// 게시판 화면에서 공통으로 쓰는 표시용 유틸.

export const ANONYMOUS = "익명";

export function displayName(name: string): string {
  return name.trim() || ANONYMOUS;
}

export function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const d = new Date(ts);
  const now = new Date();
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}

// 이름에서 뽑는 아바타 색 — Pantone 2025 팔레트에서 고른다 (브랜드 톤 유지)
const AVATAR_COLORS = [
  "bg-mocha/15 text-mocha-deep",
  "bg-tendril/20 text-tendril",
  "bg-rosetan/20 text-rosetan",
  "bg-cornflower/20 text-cornflower",
  "bg-viola/20 text-viola",
  "bg-willow/20 text-willow",
  "bg-cobblestone/25 text-cobblestone",
];

export function avatarClass(name: string): string {
  const key = displayName(name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initial(name: string): string {
  return displayName(name).slice(0, 1).toUpperCase();
}

/** 링크를 화면에 짧게 보여줄 때 (도메인만) */
export function prettyUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 사용자가 "example.com"처럼 스킴 없이 넣어도 열리게 보정 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
