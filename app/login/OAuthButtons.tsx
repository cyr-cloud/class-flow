'use client';
import { useState } from 'react';

type Key = 'google' | 'naver';

const LABEL: Record<Key, string> = { google: 'Google로 계속하기', naver: '네이버로 계속하기' };

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function NaverMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden>
      <path fill="#fff" d="M13.56 10.7 6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
    </svg>
  );
}

// 일반 폼 POST로 보내서 서버가 PKCE 쿠키를 심은 뒤 동의 화면으로 이동시킨다.
export default function OAuthButtons({ providers, next }: { providers: Key[]; next: string }) {
  const [busy, setBusy] = useState<Key | null>(null);
  return (
    <div className="mt-8 flex flex-col gap-3">
      {providers.map((p) => (
        <form key={p} action={`/api/auth/oauth/${p}`} method="post" onSubmit={() => setBusy(p)}>
          <input type="hidden" name="next" value={next} />
          <button
            disabled={busy !== null}
            className={
              p === 'naver'
                ? 'flex w-full items-center justify-center gap-3 rounded-full bg-[#03C75A] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60'
                : 'flex w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-paper px-5 py-3 text-sm font-medium text-ink transition-colors hover:border-mocha disabled:opacity-60'
            }
          >
            {p === 'naver' ? <NaverMark /> : <GoogleMark />}
            {busy === p ? '이동 중…' : LABEL[p]}
          </button>
        </form>
      ))}
    </div>
  );
}
