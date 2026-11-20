'use server';
// 결과물 올리기 (GAL-01). Next가 Origin을 검사하고, DB 함수 create_post가 강의 접근·닉네임·하루 3개를 확인한다.
import { redirect } from 'next/navigation';
import { cleanAccessKey, coursePath, parseLessonNumber, SLUG_PATTERN } from '@/lib/course/model';
import { parsePostInput } from '@/lib/gallery/model';
import { createPost } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';

export interface PostFormState { message?: string; errors?: Record<string, string> }

export async function submitPost(_prev: PostFormState, form: FormData): Promise<PostFormState> {
  const slug = String(form.get('slug') ?? '');
  const key = cleanAccessKey(form.get('key'));
  const lesson = parseLessonNumber(String(form.get('lesson') ?? ''));
  if (!SLUG_PATTERN.test(slug) || !lesson) return { message: '잘못된 요청입니다.' };

  let images: unknown = [];
  try { images = JSON.parse(String(form.get('images') ?? '[]')); } catch { /* 아래 검사에서 걸린다 */ }

  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { message: '로그인이 끝났어요. 다시 로그인해주세요.' };

  const parsed = parsePostInput({ title: form.get('title'), body: form.get('body'), images }, data.user.id);
  if (!parsed.ok) return { errors: parsed.errors, message: '입력을 확인해주세요.' };

  const result = await createPost(client, slug, key, lesson, parsed.value);
  if (!result.ok) return { message: result.message, errors: result.field ? { [result.field]: result.message } : undefined };
  redirect(coursePath(slug, key, lesson) + (key ? '&' : '?') + 'posted=1');
}
