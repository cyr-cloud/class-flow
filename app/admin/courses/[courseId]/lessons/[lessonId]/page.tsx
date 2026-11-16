import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import { getCourse, getLesson } from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';
import { removeLesson } from '../../../actions';
import { ConfirmButton, LessonForm } from '../../../ui';

const UUID = /^[0-9a-f-]{36}$/i;

// 차시 수정 — 실습 안내 마크다운 편집·미리보기 (COURSE-02)
export default async function EditLesson({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const { access } = await requireAdminPage(`/admin/courses/${courseId}/lessons/${lessonId}`);
  if (access !== 'admin') return null;
  if (!UUID.test(courseId) || !UUID.test(lessonId)) notFound();
  const client = await createUserClient({ readOnly: true });
  const [course, lesson] = await Promise.all([getCourse(client, courseId), getLesson(client, lessonId)]);
  if (!course || !lesson || lesson.course_id !== course.id) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <Link href={`/admin/courses/${course.id}`} className="text-sm text-mute hover:text-mocha">← {course.title}</Link>
      <p className="eyebrow mt-3">{lesson.number}차시</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{lesson.title}</h1>
      <div className="mt-8"><LessonForm key={lesson.updated_at} lesson={lesson} /></div>
      <section className="mt-14 border-t border-line pt-6">
        <form action={removeLesson}>
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="id" value={lesson.id} />
          <ConfirmButton label="차시 삭제" message={`${lesson.number}차시 '${lesson.title}'를 지울까요? 되돌릴 수 없어요.`} />
        </form>
      </section>
    </main>
  );
}
