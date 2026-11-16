'use server';
// 강의·차시 관리 서버 액션. Next가 Origin을 검사하고, 여기서 관리자 여부를 다시 확인하며, DB RLS가 한 번 더 막는다.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { neighborLesson, parseCourseInput, parseLessonInput } from '@/lib/course/model';
import * as store from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';

export interface FormState {
  message?: string;
  errors?: Record<string, string>;
  saved?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminClient() {
  const check = await checkAdmin({ readOnly: false });
  if (check.access !== 'admin') throw new Error('관리자만 할 수 있어요.');
  return createUserClient();
}

function fields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string' && v.length <= 25000) out[k] = v;
  return out;
}

function id(form: FormData, name: string): string {
  const v = form.get(name);
  if (typeof v !== 'string' || !UUID.test(v)) throw new Error('잘못된 요청입니다.');
  return v;
}

export async function saveCourse(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = parseCourseInput(fields(form));
  if (!parsed.ok) return { errors: parsed.errors, message: '입력을 확인해주세요.' };
  const client = await adminClient();
  const courseId = form.get('id');
  const result = typeof courseId === 'string' && courseId
    ? await store.updateCourse(client, id(form, 'id'), parsed.value)
    : await store.createCourse(client, parsed.value);
  if (!result.ok) return { message: result.message, errors: result.field ? { [result.field]: result.message } : undefined };
  revalidatePath('/admin/courses');
  if (!courseId) redirect(`/admin/courses/${result.id}`);
  return { saved: true, message: '저장했어요.' };
}

export async function removeCourse(form: FormData): Promise<void> {
  const client = await adminClient();
  await store.deleteCourse(client, id(form, 'id'));
  revalidatePath('/admin/courses');
  redirect('/admin/courses');
}

export async function addLesson(_prev: FormState, form: FormData): Promise<FormState> {
  const courseId = id(form, 'course_id');
  const parsed = parseLessonInput({ title: form.get('title') });
  if (!parsed.ok) return { errors: { title: parsed.errors.title }, message: parsed.errors.title };
  const client = await adminClient();
  const result = await store.addLesson(client, courseId, parsed.value.title);
  if (!result.ok) return { message: result.message };
  revalidatePath(`/admin/courses/${courseId}`);
  return { saved: true, message: '차시를 추가했어요.' };
}

export async function saveLesson(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = parseLessonInput(fields(form));
  if (!parsed.ok) return { errors: parsed.errors, message: '입력을 확인해주세요.' };
  const client = await adminClient();
  const result = await store.updateLesson(client, id(form, 'id'), parsed.value);
  if (!result.ok) return { message: result.message, errors: result.field ? { [result.field]: result.message } : undefined };
  revalidatePath(`/admin/courses/${id(form, 'course_id')}`);
  return { saved: true, message: '저장했어요.' };
}

export async function moveLesson(form: FormData): Promise<void> {
  const courseId = id(form, 'course_id');
  const lessonId = id(form, 'id');
  const direction = form.get('direction') === 'up' ? 'up' : 'down';
  const client = await adminClient();
  const other = neighborLesson(await store.listLessons(client, courseId), lessonId, direction);
  if (other) await store.swapLessons(client, lessonId, other.id);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function removeLesson(form: FormData): Promise<void> {
  const courseId = id(form, 'course_id');
  const client = await adminClient();
  await store.deleteLesson(client, id(form, 'id'));
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}`);
}
