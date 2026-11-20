import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/admin';
import { coursePath, courseShareUrl, nextLessonNumber } from '@/lib/course/model';
import { getCourse, listLessons } from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';
import { moveLesson, newAccessKey, removeCourse } from '../actions';
import { AddLessonForm, ConfirmButton, CopyLink, CourseForm } from '../ui';

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
  const shareUrl = courseShareUrl(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3311', course);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin/courses" className="text-sm text-mute hover:text-mocha">← 강의 목록</Link>
      <p className="eyebrow mt-3">COURSE</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{course.title}</h1>

      <section className="mt-6 rounded-2xl border border-line bg-cream px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">학생에게 보낼 링크</p>
          <Link href={coursePath(course.slug, course.visibility === 'unlisted' ? course.access_key : null)} target="_blank" className="text-xs text-mocha underline-offset-4 hover:underline">학생 화면 미리보기 ↗</Link>
        </div>
        {shareUrl ? (
          <div className="mt-2 grid gap-2">
            <CopyLink url={shareUrl} />
            {course.visibility === 'unlisted' ? (
              <form action={newAccessKey} className="flex flex-wrap items-center gap-2 text-xs text-mute">
                <input type="hidden" name="id" value={course.id} />
                링크를 받은 사람만 볼 수 있어요. 링크가 새어 나갔다면
                <ConfirmButton label="새 링크 만들기" message="새 링크를 만들면 이전에 보낸 링크는 열리지 않아요. 계속할까요?" className="text-xs text-mocha underline-offset-4 hover:underline" />
              </form>
            ) : (
              <p className="text-xs text-mute">공개 강의라 누구나 볼 수 있어요.</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs text-mute">준비 중이라 아직 학생이 볼 수 없어요. 아래 강의 정보에서 공개 범위를 &lsquo;링크 있는 사람만&rsquo;이나 &lsquo;공개&rsquo;로 바꾸면 링크가 생겨요.</p>
        )}
      </section>

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
        {/* 저장 후 서버 값으로 다시 그리도록 key를 준다(React가 폼을 처음 값으로 되돌리는 문제) */}
        <CourseForm key={course.updated_at} course={course} />
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
