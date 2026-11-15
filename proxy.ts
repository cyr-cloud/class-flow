import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/config';
import { authCookieOptions } from '@/lib/auth/cookies';

// 로그인이 필요한 화면에서만 Supabase 세션을 갱신한다. 실시간 수업 화면(/teacher, /student)은 건드리지 않는다.
export async function proxy(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: authCookieOptions(config),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: ['/me/:path*', '/admin/:path*'] };
