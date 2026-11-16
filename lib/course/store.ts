// 강의·차시 DB 읽기·쓰기. 사용자 세션 클라이언트로 부르므로 쓰기는 RLS가 관리자만 허용한다.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Course, CourseInput, Lesson, LessonInput } from './model';
import { nextLessonNumber } from './model';

const COURSE_COLUMNS = 'id, slug, title, description, cover_url, channel, external_url, visibility, created_at, updated_at';
const LESSON_COLUMNS = 'id, course_id, number, title, guide_md, example_image_url, short_code, updated_at';

export type WriteResult = { ok: true; id: string } | { ok: false; message: string; field?: string };

function writeError(error: { code?: string; message?: string }, duplicateField?: string): WriteResult {
  if (error.code === '23505') {
    return duplicateField === 'slug'
      ? { ok: false, field: 'slug', message: '이미 쓰고 있는 주소예요. 다른 주소를 적어주세요.' }
      : { ok: false, field: 'short_code', message: '이미 쓰고 있는 짧은 코드예요.' };
  }
  if (error.code === '42501') return { ok: false, message: '관리자만 할 수 있어요.' };
  if (error.code === '23514') return { ok: false, message: '입력 형식을 확인해주세요.' };
  return { ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' };
}

export async function listCourses(client: SupabaseClient): Promise<(Course & { lesson_count: number })[]> {
  const { data, error } = await client.from('courses').select(`${COURSE_COLUMNS}, lessons(count)`).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(({ lessons, ...c }) => ({ ...(c as Course), lesson_count: (lessons as { count: number }[] | null)?.[0]?.count ?? 0 }));
}

export async function getCourse(client: SupabaseClient, id: string): Promise<Course | null> {
  const { data } = await client.from('courses').select(COURSE_COLUMNS).eq('id', id).maybeSingle();
  return (data as Course | null) ?? null;
}

export async function listLessons(client: SupabaseClient, courseId: string): Promise<Lesson[]> {
  const { data } = await client.from('lessons').select(LESSON_COLUMNS).eq('course_id', courseId).order('number');
  return (data as Lesson[] | null) ?? [];
}

export async function getLesson(client: SupabaseClient, id: string): Promise<Lesson | null> {
  const { data } = await client.from('lessons').select(LESSON_COLUMNS).eq('id', id).maybeSingle();
  return (data as Lesson | null) ?? null;
}

export async function createCourse(client: SupabaseClient, input: CourseInput): Promise<WriteResult> {
  const { data, error } = await client.from('courses').insert(input).select('id').single();
  return error ? writeError(error, 'slug') : { ok: true, id: data.id };
}

export async function updateCourse(client: SupabaseClient, id: string, input: CourseInput): Promise<WriteResult> {
  const { data, error } = await client.from('courses').update(input).eq('id', id).select('id');
  if (error) return writeError(error, 'slug');
  return data.length ? { ok: true, id } : { ok: false, message: '강의를 찾지 못했어요.' };
}

export async function deleteCourse(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('courses').delete().eq('id', id).select('id');
  return !error && data.length > 0;
}

// 차시는 맨 뒤 번호로 추가한다.
export async function addLesson(client: SupabaseClient, courseId: string, title: string): Promise<WriteResult> {
  const number = nextLessonNumber(await listLessons(client, courseId));
  const { data, error } = await client.from('lessons').insert({ course_id: courseId, number, title }).select('id').single();
  return error ? writeError(error) : { ok: true, id: data.id };
}

export async function updateLesson(client: SupabaseClient, id: string, input: LessonInput): Promise<WriteResult> {
  const { data, error } = await client.from('lessons').update(input).eq('id', id).select('id');
  if (error) return writeError(error, 'short_code');
  return data.length ? { ok: true, id } : { ok: false, message: '차시를 찾지 못했어요.' };
}

export async function deleteLesson(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('lessons').delete().eq('id', id).select('id');
  return !error && data.length > 0;
}

export async function swapLessons(client: SupabaseClient, firstId: string, secondId: string): Promise<boolean> {
  const { error } = await client.rpc('swap_lesson_numbers', { first_id: firstId, second_id: secondId });
  return !error;
}
