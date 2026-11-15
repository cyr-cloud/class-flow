import 'server-only';
import { z } from 'zod';

// 스토어(yuco-store)와 같은 Supabase 프로젝트를 쓴다. 값이 없으면 로그인만 "준비 중"으로 두고
// 나머지 수업 기능은 그대로 동작해야 하므로, 실패를 예외가 아니라 null로 돌려준다.
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type AuthConfig = z.infer<typeof schema>;

export function authConfig(): AuthConfig | null {
  const r = schema.safeParse(process.env);
  return r.success ? r.data : null;
}

// 소셜 로그인. Supabase 대시보드에서 공급자를 켠 뒤에만 버튼을 보여준다.
// (켜지 않은 채 버튼을 누르면 Supabase 오류 화면이 나오므로 설정 값으로 막는다)
// naver: Supabase 기본 공급자가 아니라 "custom:naver" 사용자 지정 OAuth 공급자로 등록한다.
export const OAUTH_PROVIDERS = {
  google: { supabase: 'google', flag: 'AUTH_GOOGLE_ENABLED' },
  naver: { supabase: 'custom:naver', flag: 'AUTH_NAVER_ENABLED' },
} as const;
export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS;

export function isOAuthProviderKey(value: string): value is OAuthProviderKey {
  return Object.hasOwn(OAUTH_PROVIDERS, value);
}

export function enabledOAuthProviders(): OAuthProviderKey[] {
  if (!authConfig()) return [];
  return (Object.keys(OAUTH_PROVIDERS) as OAuthProviderKey[]).filter((k) => process.env[OAUTH_PROVIDERS[k].flag] === '1');
}
