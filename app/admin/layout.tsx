import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '관리자 — ClassFlow', robots: { index: false, follow: false } };

// /admin 아래 모든 화면은 admin 역할만 (ADM-01). 수업 진행용 teacherToken과는 별개다.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdminPage();
  if (check.access !== 'admin') {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-20">
        <p className="eyebrow">ADMIN</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">관리자만 볼 수 있는 화면이에요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          지금 계정에는 관리자 권한이 없어요. 다른 계정으로 로그인했다면 로그아웃 후 다시 로그인해주세요.
        </p>
        <Link href="/me" className="mt-8 inline-block rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft hover:border-mocha hover:text-mocha">
          마이페이지로
        </Link>
      </main>
    );
  }
  return children;
}
