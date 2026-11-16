import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import { nextLessonNumber } from '@/lib/course/model';
import { getCourse, listLessons } from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';
import { moveLesson, removeCourse } from '../actions';
import { AddLessonForm, ConfirmButton, CourseForm } from '../ui';

const arrow = 'rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:border-mocha hover:text-mocha disabled:opacity-30';

// 강의 수정 + 차시 목록·추가·순서 변경 (COURSE-01b · COURSE-02)
export default async function EditCourse({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { access } = await requireAdminPage(`/admin/courses/${courseId}`);
  if (access !== 'admin') return null;
  const client = await createUserClient({ readOnly: true });
  const course = /^[0-9a-f-]{36}$/i.test(courseId) ? await getCourse(client, courseId) : null;
  if (!course) notFound();
  const lessons = await listLessons(client, course.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin/courses" className="text-sm text-mute hover:text-mocha">← 강의 목록</Link>
      <p className="eyebrow mt-3">COURSE</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{course.title}</h1>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">차시 {lessons.length}개</h2>
        {lessons.length > 0 && (
          <ol className="mt-4 divide-y divide-line rounded-2xl border border-line bg-paper">
            {lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-14 shrink-0 text-sm text-mute">{l.number}차시</span>
                <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="min-w-0 flex-1 truncate text-ink hover:text-mocha">
                  {l.title}
                  {!l.guide_md && <span className="ml-2 text-xs text-mute">· 안내 없음</span>}
                  {l.short_code && <span className="ml-2 font-mono text-xs text-mute">/p/{l.short_code}</span>}
                </Link>
                <form action={moveLesson} className="flex gap-1">
                  <input type="hidden" name="course_id" value={course.id} />
                  <input type="hidden" name="id" value={l.id} />
                  <button name="direction" value="up" disabled={i === 0} aria-label={`${l.title} 위로`} className={arrow}>↑</button>
                  <button name="direction" value="down" disabled={i === lessons.length - 1} aria-label={`${l.title} 아래로`} className={arrow}>↓</button>
                </form>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4"><AddLessonForm courseId={course.id} nextNumber={nextLessonNumber(lessons)} /></div>
      </section>

      <section className="mt-14 border-t border-line pt-10">
        <h2 className="mb-6 text-lg font-semibold text-ink">강의 정보</h2>
        <CourseForm course={course} />
      </section>

      <section className="mt-14 border-t border-line pt-6">
        <form action={removeCourse}>
          <input type="hidden" name="id" value={course.id} />
          <ConfirmButton label="강의 삭제" message={`'${course.title}' 강의와 차시 ${lessons.length}개를 완전히 지울까요? 되돌릴 수 없어요.`} />
        </form>
      </section>
    </main>
  );
}
