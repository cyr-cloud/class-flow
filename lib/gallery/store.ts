import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAGE_SIZE, uniqueById, type PostInput, type PostSort } from './model';

// 결과물 갤러리 읽기·쓰기. 권한 판단은 DB 함수(202611200001)가 한다.

export const BANNED_MESSAGE = '업로드가 정지된 계정이에요. 결과물·댓글을 올릴 수 없어요. 궁금한 점은 강사에게 문의해주세요.';

export interface GalleryPost {
  id: string;
  title: string;
  body: string;
  images: string[];
  links: string[];
  status: 'visible' | 'hidden';
  like_count: number;
  comment_count: number;
  pinned: boolean;
  created_at: string;
  author: string;
  is_mine: boolean;
  liked: boolean;
}

export async function postsForViewer(client: SupabaseClient, slug: string, key: string | null, lesson: number,
  opts: { sort?: 'new' | 'popular'; limit?: number; offset?: number } = {}): Promise<GalleryPost[]> {
  const { data } = await client.rpc('posts_for_viewer', {
    p_slug: slug, p_key: key, p_lesson: lesson, p_sort: opts.sort ?? 'new', p_limit: opts.limit ?? 24, p_offset: opts.offset ?? 0,
  });
  return (data as GalleryPost[] | null) ?? [];
}

// 1쪽부터 page쪽까지 한꺼번에 읽는다(GAL-02 더 보기). 마지막 쪽은 한 개 더 읽어서 다음 쪽이 있는지 안다.
export async function listPosts(client: SupabaseClient, slug: string, key: string | null, lesson: number, sort: PostSort, page: number)
  : Promise<{ posts: GalleryPost[]; hasMore: boolean }> {
  const pages = await Promise.all(Array.from({ length: page }, (_, i) =>
    postsForViewer(client, slug, key, lesson, { sort, offset: i * PAGE_SIZE, limit: i === page - 1 ? PAGE_SIZE + 1 : PAGE_SIZE })));
  const hasMore = pages[page - 1].length > PAGE_SIZE;
  if (hasMore) pages[page - 1] = pages[page - 1].slice(0, PAGE_SIZE);
  return { posts: uniqueById(pages.flat()), hasMore };
}

// 결과물 하나(GAL-상세). 볼 수 없는 강의·지운 글·남의 숨긴 글이면 null → 404.
export async function postForViewer(client: SupabaseClient, slug: string, key: string | null, lesson: number, id: string): Promise<GalleryPost | null> {
  const { data } = await client.rpc('posts_for_viewer', { p_slug: slug, p_key: key, p_lesson: lesson, p_sort: 'new', p_limit: 1, p_offset: 0, p_post: id });
  return (data as GalleryPost[] | null)?.[0] ?? null;
}

export interface GalleryComment { id: string; body: string; created_at: string; author: string; is_mine: boolean }

// 결과물의 댓글(GAL-04). 오래된 것부터, 최대 200개. 볼 수 없는 강의·보이지 않는 글이면 빈 목록.
export async function commentsForViewer(client: SupabaseClient, slug: string, key: string | null, postId: string): Promise<GalleryComment[]> {
  const { data } = await client.rpc('comments_for_viewer', { p_slug: slug, p_key: key, p_post: postId });
  return (data as GalleryComment[] | null) ?? [];
}

export async function lessonPostCounts(client: SupabaseClient, slug: string, key: string | null): Promise<Map<number, number>> {
  const { data } = await client.rpc('lesson_post_counts', { p_slug: slug, p_key: key });
  return new Map(((data as { lesson_number: number; post_count: number }[] | null) ?? []).map((r) => [r.lesson_number, r.post_count]));
}

export type CreateResult = { ok: true; id: string } | { ok: false; message: string; field?: string };

export async function createPost(client: SupabaseClient, slug: string, key: string | null, lesson: number, input: PostInput): Promise<CreateResult> {
  const { data, error } = await client.rpc('create_post', {
    p_slug: slug, p_key: key, p_lesson: lesson, p_title: input.title, p_body: input.body, p_images: input.images, p_links: input.links,
  });
  if (!error && typeof data === 'string') return { ok: true, id: data };
  switch (error?.code) {
    case 'P0004': return { ok: false, message: BANNED_MESSAGE };
    case 'P0001': return { ok: false, message: '한 차시에는 하루 3개까지 올릴 수 있어요. 지운 결과물도 세요. 내일(한국 시간 자정 이후) 다시 올려주세요.' };
    case 'P0002': return { ok: false, message: '차시를 찾을 수 없어요. 링크를 다시 확인해주세요.' };
    case '42501': return { ok: false, message: '로그인과 닉네임 설정이 필요해요.' };
    case '23514': return { ok: false, message: '입력을 확인해주세요. 이미지를 다시 올려야 할 수도 있어요.', field: 'images' };
    default: return { ok: false, message: '올리지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
}

// 고치기(GAL-05). 표 규칙상 본인 것·보이는 것만 바뀐다 → 바뀐 줄이 없으면 실패.
export async function updatePost(client: SupabaseClient, id: string, input: PostInput): Promise<CreateResult> {
  const { data, error } = await client.from('posts')
    .update({ title: input.title, body: input.body, images: input.images, links: input.links })
    .eq('id', id).select('id');
  if (!error && data?.length) return { ok: true, id };
  if (error?.code === '23514') return { ok: false, message: '입력을 확인해주세요. 이미지를 다시 올려야 할 수도 있어요.', field: 'images' };
  if (error?.code === 'P0004') return { ok: false, message: BANNED_MESSAGE };
  return { ok: false, message: '고치지 못했어요. 내 결과물인지, 숨겨지지 않았는지 확인해주세요.' };
}

// 지우기(GAL-05): 상태만 deleted로 바꾼다. 본인 또는 강의 관리자만.
export async function deletePost(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.rpc('delete_post', { p_id: id });
  return !error && data === true;
}

// 오늘 이 차시에 올린 내 결과물 수(GAL-07). 읽지 못하면 null — 화면은 안내만 빼고 DB가 막는다.
export async function myPostsToday(client: SupabaseClient, slug: string, key: string | null, lesson: number): Promise<number | null> {
  const { data, error } = await client.rpc('my_posts_today', { p_slug: slug, p_key: key, p_lesson: lesson });
  return error || typeof data !== 'number' ? null : data;
}

// 관리자 신고 알림(GAL-06). 처리 안 한 신고를 결과물·댓글 단위로, 자동 숨김된 것부터. 관리자가 아니면 빈 목록.
export interface ReportAlert {
  target: 'post' | 'comment'; target_id: string; post_id: string; course_slug: string; course_title: string; lesson_number: number;
  title: string; excerpt: string; author: string; author_id: string; author_banned: boolean; status: 'visible' | 'hidden';
  report_count: number; reasons: string[]; details: string[]; last_reported_at: string; images: string[]; links: string[];
}
export async function adminReportAlerts(client: SupabaseClient, limit = 50): Promise<ReportAlert[]> {
  const { data, error } = await client.rpc('admin_report_alerts', { p_limit: limit });
  return error ? [] : ((data as ReportAlert[] | null) ?? []);
}

// 업로드 정지(ADM-02). 정지된 사람은 올리기·고치기·댓글·이미지가 DB에서 막힌다. 화면은 미리 안내만 한다.
export async function isUploadBanned(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc('is_upload_banned');
  return !error && data === true;
}

export interface UploadBan { user_id: string; nickname: string; until: string | null; reason: string; created_at: string }
export async function adminUploadBans(client: SupabaseClient): Promise<UploadBan[]> {
  const { data, error } = await client.rpc('admin_upload_bans');
  return error ? [] : ((data as UploadBan[] | null) ?? []);
}
