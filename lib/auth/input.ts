import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const codeSchema = z.string().trim().regex(/^\d{6,8}$/);

export const DEFAULT_RETURN_PATH = '/me';

// 로그인 후 돌아갈 주소. 같은 사이트 안의 경로만 허용한다(외부 주소·API·로그인 화면 자체는 거부).
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n\u0000]/.test(value) ||
    /%(?:2f|5c|0[ad])/i.test(value)
  ) return DEFAULT_RETURN_PATH;
  try {
    const url = new URL(value, 'https://classflow.invalid');
    if (
      url.origin !== 'https://classflow.invalid' ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/auth/')
    ) return DEFAULT_RETURN_PATH;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}
