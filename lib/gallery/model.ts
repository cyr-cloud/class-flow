// 결과물 갤러리 규칙 (GAL-01). DB(202611200001·0002)와 같은 규칙을 화면·API에서 먼저 확인한다.

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 버킷 제한과 같다(장당 5MB, 줄인 뒤 기준)
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024; // 브라우저가 줄이기 전 원본 한도
export const TITLE_MAX = 40;
export const BODY_MAX = 500;
export const GALLERY_BUCKET = 'gallery';

export type ImageExt = 'webp' | 'jpg' | 'png';
export const IMAGE_CONTENT_TYPE: Record<ImageExt, string> = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };

// 이미지 경로: "<user_id>/<무작위 이름>.<확장자>" — DB 검사와 같은 모양
export const IMAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/[0-9a-z-]{8,64}\.(webp|jpg|png)$/;

// 파일 이름·브라우저가 알려 준 형식은 믿지 않고 앞부분 바이트로 진짜 형식을 본다.
export function detectImageType(bytes: Uint8Array): ImageExt | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => bytes[i + k] === x);
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'webp';
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return 'jpg';
  return null;
}

export function isOwnImagePath(path: unknown, userId: string): path is string {
  return typeof path === 'string' && IMAGE_PATH_PATTERN.test(path) && path.startsWith(userId + '/');
}

export function galleryImageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${GALLERY_BUCKET}/${path}`;
}

export const MAX_LINKS = 3;
export const LINK_MAX = 500;

// 결과물 링크 한 개 검사 (GAL-01c). "github.com/..."처럼 주소만 적으면 https://를 붙여 준다.
// http://는 받지 않는다(DB도 https만). 결과는 브라우저가 정리한 주소(URL.href).
export function parseLink(raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  let v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return { ok: false, message: '링크를 적어주세요.' };
  if (/^http:\/\//i.test(v)) return { ok: false, message: 'https://로 시작하는 주소만 넣을 수 있어요.' };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) throw new Error();
    if (url.href.length > LINK_MAX) return { ok: false, message: `링크는 ${LINK_MAX}자까지예요.` };
    if (/\s/.test(url.href)) throw new Error();
    return { ok: true, value: url.href };
  } catch {
    return { ok: false, message: '주소 모양이 아니에요. 예: https://github.com/내아이디/프로젝트' };
  }
}

// 링크 미리보기에 보여 줄 짧은 이름: 도메인 + 경로 앞부분
export function linkLabel(href: string): string {
  try {
    const u = new URL(href);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    const text = u.hostname.replace(/^www\./, '') + path;
    return text.length > 48 ? text.slice(0, 47) + '…' : text;
  } catch {
    return href;
  }
}

export interface PostInput { title: string; body: string; images: string[]; links: string[] }

// 올리기 입력 검사. 이미지(0~4)·링크(0~3) 중 하나는 꼭 있어야 한다.
export function parsePostInput(f: { title?: unknown; body?: unknown; images?: unknown; links?: unknown }, userId: string):
  { ok: true; value: PostInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = typeof f.title === 'string' ? f.title.replace(/\s+/g, ' ').trim() : '';
  const body = typeof f.body === 'string' ? f.body.replace(/\r\n/g, '\n').trim() : '';
  const images = Array.isArray(f.images) ? f.images : [];
  const rawLinks = (Array.isArray(f.links) ? f.links : []).filter((l) => !(typeof l === 'string' && !l.trim()));
  if (!title) errors.title = '제목을 적어주세요.';
  else if ([...title].length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자까지예요.`;
  if ([...body].length > BODY_MAX) errors.body = `소개는 ${BODY_MAX}자까지예요.`;
  if (images.length > MAX_IMAGES) errors.images = `이미지는 ${MAX_IMAGES}장까지예요.`;
  else if (new Set(images).size !== images.length || !images.every((p) => isOwnImagePath(p, userId))) errors.images = '이미지를 다시 올려주세요.';
  const links: string[] = [];
  if (rawLinks.length > MAX_LINKS) errors.links = `링크는 ${MAX_LINKS}개까지예요.`;
  else for (const [i, raw] of rawLinks.entries()) {
    const r = parseLink(raw);
    if (!r.ok) { errors[`links.${i}`] = r.message; errors.links ??= r.message; }
    else if (!links.includes(r.value)) links.push(r.value);
  }
  // 이미지·링크 없이 글만 올려도 된다. 그때는 소개가 비어 있으면 안 된다(DB posts_has_content와 같은 규칙).
  if (images.length === 0 && rawLinks.length === 0 && !body && !errors.body) errors.body = '글만 올릴 때는 소개를 적어주세요.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, body, images: images as string[], links } };
}

// 차시 결과물 목록 (GAL-02): 최신순/인기순 + 더 보기. 주소(?sort=&page=)에 담아 새로고침·공유해도 같은 목록이 보인다.
export const PAGE_SIZE = 24;
export const MAX_PAGE = 10; // 한 화면에 240개까지. 그 이상은 "더 보기"를 숨긴다.
export type PostSort = 'new' | 'popular';

export function parseListQuery(sort: unknown, page: unknown): { sort: PostSort; page: number } {
  const s = Array.isArray(sort) ? sort[0] : sort;
  const p = Array.isArray(page) ? page[0] : page;
  const n = typeof p === 'string' && /^[1-9][0-9]{0,2}$/.test(p) ? Number(p) : 1;
  return { sort: s === 'popular' ? 'popular' : 'new', page: Math.min(n, MAX_PAGE) };
}

// 기본값(최신순·1쪽)은 주소에서 뺀다. lessonPath는 coursePath(slug, key, 차시) 결과(열쇠가 있으면 ?key= 포함).
export function postListPath(lessonPath: string, sort: PostSort, page = 1): string {
  const params = [sort === 'popular' ? 'sort=popular' : '', page > 1 ? `page=${page}` : ''].filter(Boolean).join('&');
  if (!params) return lessonPath;
  return lessonPath + (lessonPath.includes('?') ? '&' : '?') + params;
}

// 여러 쪽을 이어 붙일 때 그 사이에 새 글이 올라오면 같은 글이 두 번 나올 수 있다 → id로 한 번만.
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}
