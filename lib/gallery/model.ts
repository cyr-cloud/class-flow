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

export interface PostInput { title: string; body: string; images: string[] }

// 올리기 입력 검사. 링크 입력은 GAL-01c에서 붙인다.
export function parsePostInput(f: { title?: unknown; body?: unknown; images?: unknown }, userId: string):
  { ok: true; value: PostInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = typeof f.title === 'string' ? f.title.replace(/\s+/g, ' ').trim() : '';
  const body = typeof f.body === 'string' ? f.body.replace(/\r\n/g, '\n').trim() : '';
  const images = Array.isArray(f.images) ? f.images : [];
  if (!title) errors.title = '제목을 적어주세요.';
  else if ([...title].length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자까지예요.`;
  if ([...body].length > BODY_MAX) errors.body = `소개는 ${BODY_MAX}자까지예요.`;
  if (images.length === 0) errors.images = '이미지를 1장 이상 올려주세요.';
  else if (images.length > MAX_IMAGES) errors.images = `이미지는 ${MAX_IMAGES}장까지예요.`;
  else if (new Set(images).size !== images.length || !images.every((p) => isOwnImagePath(p, userId))) errors.images = '이미지를 다시 올려주세요.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, body, images: images as string[] } };
}
