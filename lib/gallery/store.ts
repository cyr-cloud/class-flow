import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAGE_SIZE, uniqueById, type PostInput, type PostSort } from './model';

// 결과물 갤러리 읽기·쓰기. 권한 판단은 DB 함수(202611200001)가 한다.

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
    case 'P0001': return { ok: false, message: '한 차시에는 하루 3개까지 올릴 수 있어요. 내일 다시 올려주세요.' };
    case 'P0002': return { ok: false, message: '차시를 찾을 수 없어요. 링크를 다시 확인해주세요.' };
    case '42501': return { ok: false, message: '로그인과 닉네임 설정이 필요해요.' };
    case '23514': return { ok: false, message: '입력을 확인해주세요. 이미지를 다시 올려야 할 수도 있어요.', field: 'images' };
    default: return { ok: false, message: '올리지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
}
