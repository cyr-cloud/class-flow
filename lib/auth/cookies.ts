import type { AuthConfig } from './config';

// proxy와 서버 클라이언트가 같은 쿠키 옵션을 쓰도록 한 곳에 둔다. (next/headers를 import하지 않는다)
export function authCookieOptions(env: AuthConfig) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env.NEXT_PUBLIC_SITE_URL.startsWith('https://'), path: '/' };
}
