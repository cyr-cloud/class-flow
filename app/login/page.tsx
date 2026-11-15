import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authConfig, enabledOAuthProviders } from '@/lib/auth/config';
import { safeReturnPath } from '@/lib/auth/input';
import { currentUser } from '@/lib/supabase/server';
import LoginForm from './LoginForm';
import OAuthButtons from './OAuthButtons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '로그인 — ClassFlow', robots: { index: false } };

const OAUTH_MESSAGES: Record<string, string> = {
  cancelled: '로그인을 취소했어요. 다시 시도하거나 다른 방법으로 로그인해주세요.',
  provider: '로그인을 완료하지 못했어요. 잠시 후 다시 시도하거나 다른 방법으로 로그인해주세요.',
  start: '로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; link_error?: string; oauth_error?: string }>;
}) {
  const { next: rawNext, link_error, oauth_error } = await searchParams;
  const next = safeReturnPath(rawNext);
  if (await currentUser()) redirect(next);
  const configured = !!authConfig();
  const social = enabledOAuthProviders();
  const alert = oauth_error
    ? OAUTH_MESSAGES[oauth_error] ?? OAUTH_MESSAGES.provider
    : link_error
      ? '로그인 링크가 만료됐거나 다른 브라우저에서 열렸어요. 이 브라우저에서 다시 시도해주세요.'
      : null;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <p className="eyebrow">LOGIN</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">로그인</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        처음이면 새 계정이 만들어져요. 유니크코딩 스토어 계정과 같은 계정이에요.
      </p>
      {alert && (
        <p role="alert" className="mt-6 rounded-xl border border-line-strong bg-cream px-4 py-3 text-sm text-ink-soft">
          {alert}
        </p>
      )}
      {social.length > 0 && (
        <>
          <OAuthButtons providers={social} next={next} />
          <div className="mt-8 flex items-center gap-3 text-xs text-mute" aria-hidden>
            <span className="h-px flex-1 bg-line" />또는 이메일로<span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <LoginForm configured={configured} next={next} />
      <p className="mt-10 text-sm text-mute">
        <Link href="/" className="transition-colors hover:text-mocha">← 처음 화면으로</Link>
      </p>
    </main>
  );
}
