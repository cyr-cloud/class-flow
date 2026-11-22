import type { Metadata } from 'next';

// 공유 미리보기(SHARE-03): 카카오톡·SNS가 읽는 og:* / twitter:* 메타를 한곳에서 만든다.
// 하위 페이지의 openGraph는 루트 layout 것을 통째로 덮어쓰므로 사이트 이름·이미지까지 매번 다 채운다.

export const SITE_NAME = 'ClassFlow';
export const DEFAULT_SHARE_IMAGE = { url: '/classflow-share.png', width: 1672, height: 941 };
const DESCRIPTION_MAX = 110;

// 마크다운·줄바꿈을 걷어 낸 한 문단 요약. 미리보기 설명칸은 두세 줄이라 짧게 자른다.
export function plainSummary(md: string | null | undefined, max = DESCRIPTION_MAX): string {
  if (!md) return '';
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

// 처음 나오는 쓸 수 있는 이미지 주소(https 또는 사이트 안 경로)를 고른다. 없으면 기본 공유 이미지.
export function pickShareImage(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (c && (c.startsWith('https://') || c.startsWith('/'))) return c;
  }
  return DEFAULT_SHARE_IMAGE.url;
}

export interface ShareInput {
  title: string;        // <title>에 들어갈 전체 제목
  shareTitle?: string;  // 미리보기 카드 제목(사이트 이름 없이 짧게). 없으면 title
  description: string;
  path: string;         // 사이트 안 경로(?key= 포함). metadataBase 기준으로 절대 주소가 된다
  image: string;
  imageAlt: string;
  index: boolean;       // 공개 강의의 보이는 글만 검색에 노출
}

export function shareMetadata(input: ShareInput): Metadata {
  const shareTitle = input.shareTitle ?? input.title;
  const description = input.description || undefined;
  const image = input.image === DEFAULT_SHARE_IMAGE.url
    ? { ...DEFAULT_SHARE_IMAGE, alt: input.imageAlt }
    : { url: input.image, alt: input.imageAlt };
  return {
    title: input.title,
    description,
    robots: input.index ? undefined : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      url: input.path,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [input.image] },
  };
}

// 배포 주소가 정해지면 NEXT_PUBLIC_SITE_URL을 쓰고, 없으면 지금 쓰는 Vercel 주소. og:image·og:url의 기준이 된다.
export function siteBase(env: string | undefined): URL {
  try {
    if (env) return new URL(env);
  } catch {
    // 잘못된 값이면 기본 주소로
  }
  return new URL('https://class-flow-fawn.vercel.app');
}
