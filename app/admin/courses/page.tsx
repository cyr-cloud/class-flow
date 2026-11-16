import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';
import { CHANNELS } from '@/lib/course/model';
import { listCourses } from '@/lib/course/store';
import { createUserClient } from '@/lib/supabase/server';

// 강의 목록 (COURSE-01b)
export default async function AdminCourses() {
  const { access } = await requireAdminPage('/admin/courses');
  if (access !== 'admin') return null;
  const courses = await listCourses(await createUserClient({ readOnly: true }));
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin" className="text-sm text-mute hover:text-mocha">← 관리자</Link>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">COURSE</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">강의</h1>
        </div>
        <Link href="/admin/courses/new" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-mocha-deep">새 강의</Link>
      </div>
      {courses.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-soft">
          아직 강의가 없어요. <b>새 강의</b>로 첫 강의를 만들어 보세요.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-paper">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/courses/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-cream">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{c.title}</p>
                  <p className="mt-0.5 text-xs text-mute">/courses/{c.slug} · {CHANNELS[c.channel]} · 차시 {c.lesson_count}개</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${c.visibility === 'public' ? 'bg-mocha-tint text-mocha-deep' : 'bg-gardenia text-ink-soft'}`}>
                  {c.visibility === 'public' ? '공개' : '준비 중'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
