import type { Metadata } from 'next';
import Link from 'next/link';
import { checkAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '관리자 — ClassFlow', robots: { index: false, follow: false } };

// /admin 아래 모든 화면은 admin 역할만 (ADM-01). 수업 진행용 teacherToken과는 별개다.
// 로그인 안 한 사람은 각 page의 requireAdminPage(자기 주소)가 로그인 화면으로 보낸다 → 로그인 뒤 그 화면으로 돌아온다.
// (여기서 보내면 어느 화면이든 /admin으로만 돌아와서 page에 맡긴다. 모든 admin page가 requireAdminPage를 부른다.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await checkAdmin();
  if (check.access === 'forbidden') {
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
