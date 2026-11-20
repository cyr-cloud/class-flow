import 'server-only';
import { cache } from 'react';
import { cleanAccessKey, SLUG_PATTERN } from '@/lib/course/model';
import { courseForViewer, lessonsForViewer } from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';

// 학생용 강의 조회(HOME-02·03). 보여 줄지 말지는 DB 함수가 정한다:
// 공개 강의 · 열쇠가 맞는 링크 공개 강의 · 관리자/강의 주인의 미리보기. 그 밖에는 null → 404(있는지도 알리지 않는다).
export const loadCourse = cache(async (slug: string, rawKey: unknown) => {
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) return null;
  const key = cleanAccessKey(Array.isArray(rawKey) ? rawKey[0] : rawKey);
  try {
    const client = await createUserClient({ readOnly: true });
    const [course, lessons] = await Promise.all([courseForViewer(client, slug, key), lessonsForViewer(client, slug, key)]);
    if (!course) return null;
    // 링크 공개 강의만 열쇠를 다음 링크로 넘긴다(공개 강의 주소에는 붙이지 않는다).
    return { course, lessons, key: course.visibility === 'unlisted' ? key : null };
  } catch {
    return null;
  }
});
