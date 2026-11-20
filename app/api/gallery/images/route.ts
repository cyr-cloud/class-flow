import { randomUUID } from 'node:crypto';
import { authConfig } from '@/lib/auth/config';
import { GALLERY_BUCKET, IMAGE_CONTENT_TYPE, MAX_IMAGE_BYTES, detectImageType, galleryImageUrl, isOwnImagePath } from '@/lib/gallery/model';
import { BANNED_MESSAGE, isUploadBanned } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 결과물 이미지 올리기·지우기 (GAL-01b). 로그인 쿠키가 httpOnly라 브라우저가 Storage에 바로 못 올리므로 서버를 거친다.
// 한 번 더 막는 곳: 버킷(5MB·형식), Storage RLS(자기 폴더·하루 40장).
function guard(request: Request): Response | null {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  if (!origin || origin !== expected) return Response.json({ message: '사이트에서 다시 시도해주세요.' }, { status: 403 });
  if (!authConfig()) return Response.json({ message: '로그인 서비스를 준비 중입니다.' }, { status: 503 });
  return null;
}

async function signedIn() {
  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  return data.user ? { client, userId: data.user.id } : null;
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) {
    return Response.json({ message: '이미지는 장당 5MB까지예요.' }, { status: 413 });
  }
  try {
    const session = await signedIn();
    if (!session) return Response.json({ message: '로그인이 필요해요.' }, { status: 401 });
    // 업로드 정지(ADM-02)는 Storage RLS도 막지만, 정확한 안내를 위해 먼저 확인한다.
    if (await isUploadBanned(session.client)) return Response.json({ message: BANNED_MESSAGE }, { status: 403 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return Response.json({ message: '이미지를 골라주세요.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return Response.json({ message: '이미지는 장당 5MB까지예요.' }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = detectImageType(bytes);
    if (!ext) return Response.json({ message: 'webp·jpg·png 이미지만 올릴 수 있어요.' }, { status: 415 });
    const path = `${session.userId}/${randomUUID()}.${ext}`;
    const { error } = await session.client.storage.from(GALLERY_BUCKET).upload(path, bytes, { contentType: IMAGE_CONTENT_TYPE[ext], upsert: false, cacheControl: '31536000' });
    if (error) {
      // Storage RLS(하루 40장 등)에 걸리면 403 계열 오류가 온다.
      const limited = /row-level security|policy|unauthorized/i.test(error.message);
      return Response.json({ message: limited ? '오늘은 이미지를 더 올릴 수 없어요. 내일 다시 시도해주세요.' : '이미지를 올리지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: limited ? 429 : 503 });
    }
    return Response.json({ path, url: galleryImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, path) });
  } catch {
    return Response.json({ message: '이미지를 올리지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
}

// 올리기 전에 빼 버린 이미지 정리. 자기 폴더 것만(Storage RLS도 같은 규칙).
export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  try {
    const session = await signedIn();
    if (!session) return Response.json({ message: '로그인이 필요해요.' }, { status: 401 });
    const raw = await request.text();
    if (raw.length > 512) return Response.json({ message: '잘못된 요청입니다.' }, { status: 413 });
    const { path } = JSON.parse(raw) as { path?: unknown };
    if (!isOwnImagePath(path, session.userId)) return Response.json({ message: '잘못된 요청입니다.' }, { status: 400 });
    const { data, error } = await session.client.storage.from(GALLERY_BUCKET).remove([path]);
    if (error) return Response.json({ message: '지우지 못했어요.' }, { status: 503 });
    return Response.json({ ok: true, removed: data?.length ?? 0 });
  } catch {
    return Response.json({ message: '잘못된 요청입니다.' }, { status: 400 });
  }
}
