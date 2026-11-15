import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { authConfig } from '@/lib/auth/config';
import { authCookieOptions } from '@/lib/auth/cookies';

// 사용자 세션용 클라이언트. publishable key라 RLS 규칙을 그대로 따른다.
// readOnly: 서버 컴포넌트처럼 쿠키를 쓸 수 없는 곳에서 사용(세션 갱신은 proxy가 맡는다).
export async function createUserClient({ readOnly = false }: { readOnly?: boolean } = {}) {
  const env = authConfig();
  if (!env) throw new Error('인증 서비스 설정이 필요합니다.');
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: authCookieOptions(env),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        if (readOnly) return;
        for (const { name, value, options } of values) cookieStore.set(name, value, options);
      },
    },
  });
}

// 로그인한 사용자(없으면 null). 서버 컴포넌트에서 쓰도록 쿠키를 쓰지 않는다.
export async function currentUser() {
  if (!authConfig()) return null;
  try {
    const client = await createUserClient({ readOnly: true });
    const { data } = await client.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
