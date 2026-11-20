import { NextResponse } from 'next/server';
import { createUserClient } from '@/lib/supabase/server';
import { authConfig } from '@/lib/auth/config';
import { safeReturnPath } from '@/lib/auth/input';
import { nicknameSetupPath } from '@/lib/profile/nickname';
import { signupState } from '@/lib/profile/setup';

export const dynamic = 'force-dynamic';

function privateRedirect(url: URL) {
  const r = NextResponse.redirect(url);
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}

// 메일의 로그인 링크가 돌아오는 곳. PKCE라 링크를 요청한 같은 브라우저에서만 로그인된다.
export async function GET(request: Request) {
  const config = authConfig();
  if (!config) return new Response('인증 설정을 준비 중입니다.', { status: 503 });
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeReturnPath(url.searchParams.get('next'));
  // 구글 동의 화면에서 취소했거나 공급자 설정이 안 된 경우 Supabase가 error를 붙여 돌려보낸다.
  if (url.searchParams.get('error')) {
    const fail = new URL('/login', config.NEXT_PUBLIC_SITE_URL);
    fail.searchParams.set('oauth_error', url.searchParams.get('error') === 'access_denied' ? 'cancelled' : 'provider');
    fail.searchParams.set('next', next);
    return privateRedirect(fail);
  }
  if (code && code.length < 2048) {
    try {
      const client = await createUserClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        // 첫 로그인(닉네임 없음)이거나 지금 판 약관 동의·만 14세 확인이 없으면 닉네임 화면을 거쳐 원래 가려던 곳으로 간다.
        const named = (await signupState(client, data.user.id)).complete;
        return privateRedirect(new URL(named ? next : nicknameSetupPath(next), config.NEXT_PUBLIC_SITE_URL));
      }
    } catch {}
  }
  const fail = new URL('/login', config.NEXT_PUBLIC_SITE_URL);
  fail.searchParams.set('link_error', '1');
  fail.searchParams.set('next', next);
  return privateRedirect(fail);
}
