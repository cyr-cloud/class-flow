import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { GALLERY_BUCKET } from './model';

// 결과물 정리 작업 (GAL-05). 하루 한 번:
// 1) 지운 지 30일 지난 결과물을 표에서 완전히 지운다(purge_deleted_posts, 댓글·좋아요도 같이 지워진다)
// 2) 어떤 결과물에도 안 걸린 하루 지난 이미지를 Storage에서 지운다(gallery_orphan_images)
// 둘 다 service_role 전용이라 SUPABASE_SERVICE_ROLE_KEY가 있어야 한다. 이 키는 서버 환경 변수에만 둔다.

export async function runGalleryCleanup(): Promise<{ releasedImages: number; removedImages: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았어요.');
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const purged = await admin.rpc('purge_deleted_posts');
  if (purged.error) throw new Error('지운 결과물 정리 실패: ' + purged.error.message);
  // 완전 삭제된 결과물이 쓰던 이미지 수(이 파일들은 아래 2)에서 함께 지워진다)
  const releasedImages = new Set(((purged.data as { image_path: string }[] | null) ?? []).map((r) => r.image_path)).size;

  let removedImages = 0;
  for (let round = 0; round < 10; round++) { // 한 번에 최대 5,000장
    const { data, error } = await admin.rpc('gallery_orphan_images', { p_limit: 500 });
    if (error) throw new Error('안 쓰이는 이미지 찾기 실패: ' + error.message);
    const names = ((data as { name: string }[] | null) ?? []).map((r) => r.name);
    if (names.length === 0) break;
    for (let i = 0; i < names.length; i += 100) {
      const removed = await admin.storage.from(GALLERY_BUCKET).remove(names.slice(i, i + 100));
      if (removed.error) throw new Error('이미지 지우기 실패: ' + removed.error.message);
      removedImages += removed.data?.length ?? 0;
    }
    if (names.length < 500) break;
  }
  return { releasedImages, removedImages };
}
