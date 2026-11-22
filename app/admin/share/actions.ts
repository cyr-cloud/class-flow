'use server';
// 짧은 코드 한 번에 만들기 (SHARE-01). 관리자만. 이미 코드가 있는 차시는 그대로 두고, 다른 강의와 겹치면 건너뛴다.
import { revalidatePath } from 'next/cache';
import { checkAdmin } from '@/lib/auth/admin';
import { SHORT_PREFIX_PATTERN, suggestShortCodes } from '@/lib/course/model';
import { listLessons } from '@/lib/course/store';
import { isPostId } from '@/lib/gallery/model';
import { createUserClient } from '@/lib/supabase/server';

export type FillResult = { ok: boolean; message: string };

export async function fillShortCodes(courseId: string, rawPrefix: string): Promise<FillResult> {
  const prefix = String(rawPrefix ?? '').trim().toLowerCase();
  if (!isPostId(courseId)) return { ok: false, message: '잘못된 요청입니다.' };
  if (!SHORT_PREFIX_PATTERN.test(prefix)) return { ok: false, message: '앞글자는 영문 소문자 2~12자로 적어 주세요. 예: py' };
  const check = await checkAdmin({ readOnly: false });
  if (check.access !== 'admin') return { ok: false, message: '관리자만 할 수 있어요.' };
  const client = await createUserClient();
  const plan = suggestShortCodes(prefix, await listLessons(client, courseId));
  if (plan.length === 0) return { ok: true, message: '모든 차시에 이미 짧은 코드가 있어요.' };
  let done = 0;
  const skipped: string[] = [];
  for (const { id, code } of plan) {
    const { error } = await client.from('lessons').update({ short_code: code }).eq('id', id);
    if (error) skipped.push(code); else done += 1;
  }
  revalidatePath('/admin/share');
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: skipped.length === 0, message: `${done}개 만들었어요.` + (skipped.length ? ` 이미 다른 곳에서 쓰는 코드라 건너뜀: ${skipped.join(', ')}` : '') };
}
