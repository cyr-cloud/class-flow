import 'server-only';
import type { Channel } from '@/lib/course/model';
import { authConfig } from '@/lib/auth/config';
import { createUserClient } from '@/lib/supabase/server';

// 메인 화면(HOME-01) 데이터. 공개 강의만 — 링크 공개·준비 중은 DB 함수(202611220004)가 빼 준다.

export interface HomeCourse { slug: string; title: string; description: string; cover_url: string | null; channel: Channel; lesson_count: number; post_count: number }
export interface HomePost {
  id: string; title: string; image: string | null; has_link: boolean; author: string;
  course_slug: string; course_title: string; lesson_number: number; like_count: number; created_at: string;
}

// DB에 못 닿아도 첫 화면(실시간 수업 입장)은 떠야 하니 빈 목록으로 돌려준다.
export async function homeFeed(): Promise<{ courses: HomeCourse[]; posts: HomePost[] }> {
  if (!authConfig()) return { courses: [], posts: [] };
  try {
    const client = await createUserClient({ readOnly: true });
    const [courses, posts] = await Promise.all([
      client.rpc('home_courses', { p_limit: 12 }),
      client.rpc('home_recent_posts', { p_limit: 8 }),
    ]);
    return {
      courses: courses.error ? [] : ((courses.data as HomeCourse[] | null) ?? []),
      posts: posts.error ? [] : ((posts.data as HomePost[] | null) ?? []),
    };
  } catch {
    return { courses: [], posts: [] };
  }
}
