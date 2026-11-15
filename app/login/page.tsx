import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/auth/config';
import { safeReturnPath } from '@/lib/auth/input';
import { currentUser } from '@/lib/supabase/server';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '로그인 — ClassFlow', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; link_error?: string }> }) {
  const { next: rawNext, link_error } = await searchParams;
  const next = safeReturnPath(rawNext);
  if (await currentUser()) redirect(next);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <p className="eyebrow">LOGIN</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">이메일로 로그인</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        메일로 받은 로그인 링크나 인증번호로 시작해요. 처음이면 새 계정이 만들어져요.
        <br />
        유니크코딩 스토어 계정과 같은 계정이에요.
      </p>
      {link_error && (
        <p role="alert" className="mt-6 rounded-xl border border-line-strong bg-cream px-4 py-3 text-sm text-ink-soft">
          로그인 링크가 만료됐거나 다른 브라우저에서 열렸어요. 이 브라우저에서 다시 메일을 받아주세요.
        </p>
      )}
      <LoginForm configured={!!authConfig()} next={next} />
      <p className="mt-10 text-sm text-mute">
        <Link href="/" className="transition-colors hover:text-mocha">← 처음 화면으로</Link>
      </p>
    </main>
  );
}
