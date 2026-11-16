// 강의(courses)·차시(lessons) 입력 규칙 (COURSE-01·02). DB 검사(202611160003)와 같은 규칙을 화면에서 먼저 확인한다.
// 스키마: yuco-store/server/supabase/migrations/202611160003_courses_lessons.sql

export const CHANNELS = { youtube: '유튜브', inflearn: '인프런', live: '실시간 수업', other: '기타' } as const;
export type Channel = keyof typeof CHANNELS;
export const VISIBILITIES = { draft: '준비 중 (관리자만 보기)', public: '공개' } as const;
export type Visibility = keyof typeof VISIBILITIES;

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
  channel: Channel;
  external_url: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  number: number;
  title: string;
  guide_md: string;
  example_image_url: string | null;
  short_code: string | null;
  updated_at: string;
}

export type CourseInput = Pick<Course, 'slug' | 'title' | 'description' | 'cover_url' | 'channel' | 'external_url' | 'visibility'>;
export type LessonInput = Pick<Lesson, 'title' | 'guide_md' | 'example_image_url' | 'short_code'>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

type Fields = Record<string, unknown>;
const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SHORT_CODE_PATTERN = /^[a-z0-9]{3,16}$/;

// 비어 있으면 null, https 주소만 허용(javascript: 등 차단).
export function optionalHttpsUrl(value: unknown): { ok: true; value: string | null } | { ok: false } {
  const v = text(value);
  if (!v) return { ok: true, value: null };
  if (v.length > 500) return { ok: false };
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return { ok: false };
    return { ok: true, value: url.href };
  } catch {
    return { ok: false };
  }
}

export function parseCourseInput(f: Fields): Parsed<CourseInput> {
  const errors: Record<string, string> = {};
  const slug = text(f.slug).toLowerCase();
  const title = text(f.title).replace(/\s+/g, ' ');
  const description = text(f.description);
  const channel = text(f.channel) as Channel;
  const visibility = text(f.visibility) as Visibility;
  const cover = optionalHttpsUrl(f.cover_url);
  const external = optionalHttpsUrl(f.external_url);

  if (slug.length < 2 || slug.length > 60 || !SLUG_PATTERN.test(slug)) errors.slug = '주소는 영문 소문자·숫자와 하이픈(-)으로 2~60자. 예: python-basic';
  if (!title || [...title].length > 80) errors.title = '강의 이름은 1~80자로 적어주세요.';
  if ([...description].length > 2000) errors.description = '소개는 2000자까지 쓸 수 있어요.';
  if (!(channel in CHANNELS)) errors.channel = '채널을 골라주세요.';
  if (!(visibility in VISIBILITIES)) errors.visibility = '공개 범위를 골라주세요.';
  if (!cover.ok) errors.cover_url = '표지는 https:// 로 시작하는 이미지 주소만 넣을 수 있어요.';
  if (!external.ok) errors.external_url = '강의 링크는 https:// 로 시작하는 주소만 넣을 수 있어요.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { slug, title, description, channel, visibility, cover_url: cover.ok ? cover.value : null, external_url: external.ok ? external.value : null },
  };
}

export function parseLessonInput(f: Fields): Parsed<LessonInput> {
  const errors: Record<string, string> = {};
  const title = text(f.title).replace(/\s+/g, ' ');
  const guide = text(f.guide_md);
  const shortCode = text(f.short_code).toLowerCase();
  const image = optionalHttpsUrl(f.example_image_url);

  if (!title || [...title].length > 80) errors.title = '차시 제목은 1~80자로 적어주세요.';
  if (guide.length > 20000) errors.guide_md = '실습 안내는 20000자까지 쓸 수 있어요.';
  if (shortCode && !SHORT_CODE_PATTERN.test(shortCode)) errors.short_code = '짧은 코드는 영문 소문자·숫자 3~16자. 예: py03';
  if (!image.ok) errors.example_image_url = '예시 이미지는 https:// 로 시작하는 주소만 넣을 수 있어요.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, guide_md: guide, short_code: shortCode || null, example_image_url: image.ok ? image.value : null } };
}

// 강의 이름으로 주소(slug) 후보를 만든다. 한글만 있으면 빈 값 → 직접 입력.
export function suggestSlug(title: string): string {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

// 번호 순으로 정렬된 차시에서 위/아래 이웃을 찾는다(순서 바꾸기).
export function neighborLesson<T extends { id: string; number: number }>(lessons: T[], id: string, direction: 'up' | 'down'): T | null {
  const sorted = [...lessons].sort((a, b) => a.number - b.number);
  const index = sorted.findIndex((l) => l.id === id);
  if (index < 0) return null;
  return sorted[direction === 'up' ? index - 1 : index + 1] ?? null;
}

export function nextLessonNumber(lessons: { number: number }[]): number {
  return lessons.reduce((max, l) => Math.max(max, l.number), 0) + 1;
}
