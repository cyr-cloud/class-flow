'use server';
// 결과물 올리기 (GAL-01). Next가 Origin을 검사하고, DB 함수 create_post가 강의 접근·닉네임·하루 3개를 확인한다.
import { redirect } from 'next/navigation';
import { cleanAccessKey, coursePath, parseLessonNumber, SLUG_PATTERN } from '@/lib/course/model';
import { isPostId, parseComment, parsePostInput, parseReport, postPath } from '@/lib/gallery/model';
import { BANNED_MESSAGE, CONSENT_MESSAGE, createPost, deletePost as deletePostRow, postForViewer, updatePost } from '@/lib/gallery/store';
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

  // 수정(GAL-05): postId가 있으면 그 결과물을 고친다. 본인 것·보이는 것만 고쳐지는 건 DB 규칙(posts_owner_edit)이 지킨다.
  const postId = String(form.get('postId') ?? '');
  if (postId) {
    if (!isPostId(postId)) return { message: '잘못된 요청입니다.' };
    const updated = await updatePost(client, postId, parsed.value);
    if (!updated.ok) return { message: updated.message, errors: updated.field ? { [updated.field]: updated.message } : undefined };
    const path = postPath(coursePath(slug, key, lesson), postId);
    redirect(path + (key ? '&' : '?') + 'updated=1');
  }

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

// 댓글 쓰기·지우기 (GAL-04). 닉네임 필수·하루 50개·보이는 글만은 DB(202611200005)가 지킨다.
type CommentTarget = { slug: string; key: string | null; lesson: number; postId: string };
export type CommentResult = { ok: true } | { ok: false; message: string };

async function commentContext(input: CommentTarget) {
  const key = cleanAccessKey(input.key);
  const lesson = parseLessonNumber(String(input.lesson));
  if (!SLUG_PATTERN.test(input.slug) || !lesson || !isPostId(input.postId)) return null;
  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  return { client, key, lesson, user: data.user };
}

export async function addComment(input: CommentTarget & { body: string }): Promise<CommentResult> {
  const ctx = await commentContext(input);
  if (!ctx) return { ok: false, message: '잘못된 요청입니다.' };
  if (!ctx.user) return { ok: false, message: '로그인이 끝났어요. 다시 로그인해주세요.' };
  const parsed = parseComment(input.body);
  if (!parsed.ok) return parsed;
  const post = await postForViewer(ctx.client, input.slug, ctx.key, ctx.lesson, input.postId);
  if (!post || post.status !== 'visible') return { ok: false, message: '결과물을 찾을 수 없어요.' };
  const { error } = await ctx.client.from('comments').insert({ post_id: input.postId, user_id: ctx.user.id, body: parsed.value });
  if (!error) return { ok: true };
  switch (error.code) {
    case 'P0004': return { ok: false, message: BANNED_MESSAGE };
    case 'P0005': return { ok: false, message: CONSENT_MESSAGE };
    case 'P0001': return { ok: false, message: '댓글은 하루 50개까지 쓸 수 있어요. 내일 다시 써주세요.' };
    case '42501': return { ok: false, message: '닉네임을 정한 뒤에 댓글을 쓸 수 있어요.' };
    case '23514': return { ok: false, message: '댓글은 1~300자로 적어주세요.' };
    default: return { ok: false, message: '댓글을 올리지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
}

export async function deleteComment(input: CommentTarget & { commentId: string }): Promise<CommentResult> {
  const ctx = await commentContext(input);
  if (!ctx || !isPostId(input.commentId)) return { ok: false, message: '잘못된 요청입니다.' };
  if (!ctx.user) return { ok: false, message: '로그인이 끝났어요. 다시 로그인해주세요.' };
  // 표 규칙상 본인 것(또는 강의 관리자)만 지워진다. 남의 것이면 0개가 지워진다.
  const { data, error } = await ctx.client.from('comments').delete().eq('id', input.commentId).eq('post_id', input.postId).select('id');
  if (error || !data?.length) return { ok: false, message: '댓글을 지우지 못했어요.' };
  return { ok: true };
}

// 결과물 지우기 (GAL-05). 바로 안 보이게 되고, 30일 뒤 정리 작업이 완전히 지운다.
export async function deletePost(input: { slug: string; key: string | null; lesson: number; postId: string }): Promise<{ ok: false; message: string }> {
  const key = cleanAccessKey(input.key);
  const lesson = parseLessonNumber(String(input.lesson));
  if (!SLUG_PATTERN.test(input.slug) || !lesson || !isPostId(input.postId)) return { ok: false, message: '잘못된 요청입니다.' };
  const client = await createUserClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return { ok: false, message: '로그인이 끝났어요. 다시 로그인해주세요.' };
  if (!(await deletePostRow(client, input.postId))) return { ok: false, message: '결과물을 지우지 못했어요.' };
  redirect(coursePath(input.slug, key, lesson) + (key ? '&' : '?') + 'deleted=1');
}

// 신고 (GAL-06). 같은 사람 중복 신고는 한 번만 세고, 서로 다른 3명이면 DB가 자동으로 숨긴다(report_content).
export async function reportContent(input: CommentTarget & { target: string; targetId: string; reason: string; detail?: string }): Promise<CommentResult> {
  const ctx = await commentContext(input);
  if (!ctx || !isPostId(input.targetId)) return { ok: false, message: '잘못된 요청입니다.' };
  if (!ctx.user) return { ok: false, message: '로그인하면 신고할 수 있어요.' };
  const parsed = parseReport(input);
  if (!parsed.ok) return parsed;
  if (parsed.value.target === 'post' && input.targetId !== input.postId) return { ok: false, message: '잘못된 요청입니다.' };
  const post = await postForViewer(ctx.client, input.slug, ctx.key, ctx.lesson, input.postId);
  if (!post || post.status !== 'visible') return { ok: false, message: '결과물을 찾을 수 없어요.' };
  const { data, error } = await ctx.client.rpc('report_content', {
    p_target: parsed.value.target, p_id: input.targetId, p_reason: parsed.value.reason, p_detail: parsed.value.detail,
  });
  if (error) return { ok: false, message: '신고하지 못했어요. 잠시 후 다시 시도해주세요.' };
  if (data !== true) return { ok: false, message: '내 글이거나 이미 숨겨진 글은 신고할 수 없어요.' };
  return { ok: true };
}
