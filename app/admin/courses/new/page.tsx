import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';
import { CourseForm } from '../ui';

export default async function NewCourse() {
  const { access } = await requireAdminPage('/admin/courses/new');
  if (access !== 'admin') return null;
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/admin/courses" className="text-sm text-mute hover:text-mocha">← 강의 목록</Link>
      <p className="eyebrow mt-3">COURSE</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">새 강의</h1>
      <p className="mt-2 text-sm text-ink-soft">처음엔 &lsquo;준비 중&rsquo;으로 만들고, 차시까지 채운 뒤 공개로 바꾸면 돼요.</p>
      <div className="mt-8"><CourseForm /></div>
    </main>
  );
}
