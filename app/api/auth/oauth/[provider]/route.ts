import { NextResponse } from 'next/server';
import { authConfig, enabledOAuthProviders, isOAuthProviderKey, OAUTH_PROVIDERS } from '@/lib/auth/config';
import { safeReturnPath } from '@/lib/auth/input';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function back(site: string, next: string, reason: string) {
  const url = new URL('/login', site);
  url.searchParams.set('next', next);
  url.searchParams.set('oauth_error', reason);
  return NextResponse.redirect(url, 303);
}

// 로그인 화면의 "Google로 계속하기" / "네이버로 계속하기" 폼이 POST로 부른다.
// Supabase가 PKCE 검증값을 쿠키에 심고 동의 화면 주소를 돌려주면 그리로 보낸다.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const config = authConfig();
  if (!config || !isOAuthProviderKey(provider) || !enabledOAuthProviders().includes(provider)) {
    return Response.json({ message: '이 로그인 방법은 준비 중입니다.' }, { status: 404 });
  }

  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(config.NEXT_PUBLIC_SITE_URL).origin) {
    return Response.json({ message: '사이트에서 다시 시도해주세요.' }, { status: 403 });
  }

  let next = '/me';
  try {
    next = safeReturnPath((await request.formData()).get('next'));
  } catch {}

  try {
    const callback = new URL('/auth/callback', config.NEXT_PUBLIC_SITE_URL);
    callback.searchParams.set('next', next);
    const client = await createUserClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: OAUTH_PROVIDERS[provider].supabase,
      options: {
        redirectTo: callback.href,
        skipBrowserRedirect: true,
        // 구글: 여러 계정 중 고르게 한다. 네이버는 별도 파라미터 없이 동의 화면으로 간다.
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });
    if (error || !data.url) return back(config.NEXT_PUBLIC_SITE_URL, next, 'start');
    const response = NextResponse.redirect(data.url, 303);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return back(config.NEXT_PUBLIC_SITE_URL, next, 'start');
  }
}
