'use server';
// 결과물 올리기 (GAL-01). Next가 Origin을 검사하고, DB 함수 create_post가 강의 접근·닉네임·하루 3개를 확인한다.
import { redirect } from 'next/navigation';
import { cleanAccessKey, coursePath, parseLessonNumber, SLUG_PATTERN } from '@/lib/course/model';
import { isPostId, parsePostInput } from '@/lib/gallery/model';
import { createPost, postForViewer } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';

export interface PostFormState { message?: string; errors?: Record<string, string> }

export async function submitPost(_prev: PostFormState, form: FormData): Promise<PostFormState> {
  const slug = String(form.get('slug') ?? '');
  const key = cleanAccessKey(form.get('key'));
  const lesson = parseLessonNumber(String(form.get('lesson') ?? ''));
  if (!SLUG_PATTERN.test(slug) || !lesson) return { message: '잘못된 요청입니다.' };

  let images: unknown = [];
  try { images = JSON.parse(String(form.get('images') ?? '[]')); } catch { /* 아래 검사에서 걸린다 */ }
  const links = form.getAll('link').slice(0, 10);

  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { message: '로그인이 끝났어요. 다시 로그인해주세요.' };

  const parsed = parsePostInput({ title: form.get('title'), body: form.get('body'), images, links }, data.user.id);
  if (!parsed.ok) return { errors: parsed.errors, message: '입력을 확인해주세요.' };

  const result = await createPost(client, slug, key, lesson, parsed.value);
  if (!result.ok) return { message: result.message, errors: result.field ? { [result.field]: result.message } : undefined };
  redirect(coursePath(slug, key, lesson) + (key ? '&' : '?') + 'posted=1');
}

// 좋아요 누르기·취소 (GAL-03). 원하는 상태(liked)를 받아서 그대로 맞춘다 → 두 번 눌려도 결과가 같다.
// 표 규칙(1인 1회, 본인 것만 지움, 보이는 글만)은 DB가 지키고, 여기서는 그 강의를 볼 수 있는지 먼저 확인한다.
export type LikeResult = { ok: true; liked: boolean; count: number } | { ok: false; message: string; login?: boolean };

export async function setLike(input: { slug: string; key: string | null; lesson: number; postId: string; liked: boolean }): Promise<LikeResult> {
  const key = cleanAccessKey(input.key);
  const lesson = parseLessonNumber(String(input.lesson));
  if (!SLUG_PATTERN.test(input.slug) || !lesson || !isPostId(input.postId) || typeof input.liked !== 'boolean') return { ok: false, message: '잘못된 요청입니다.' };

  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { ok: false, message: '로그인하면 좋아요를 누를 수 있어요.', login: true };
  const post = await postForViewer(client, input.slug, key, lesson, input.postId);
  if (!post || post.status !== 'visible') return { ok: false, message: '결과물을 찾을 수 없어요.' };

  if (input.liked && !post.liked) {
    const { error } = await client.from('post_likes').insert({ post_id: input.postId, user_id: data.user.id });
    if (error && error.code !== '23505') return { ok: false, message: '좋아요를 누르지 못했어요. 잠시 후 다시 시도해주세요.' };
  } else if (!input.liked && post.liked) {
    const { error } = await client.from('post_likes').delete().eq('post_id', input.postId).eq('user_id', data.user.id);
    if (error) return { ok: false, message: '좋아요를 취소하지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
  const fresh = await postForViewer(client, input.slug, key, lesson, input.postId);
  return fresh ? { ok: true, liked: fresh.liked, count: fresh.like_count } : { ok: false, message: '결과물을 찾을 수 없어요.' };
}
