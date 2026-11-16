import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import type { AuthProvider } from './service';
import { authConfig } from './config';
import { readNickname } from '@/lib/profile/store';

export async function authProvider(): Promise<AuthProvider> {
  const client = await createUserClient();
  return {
    async send(email, next) {
      const callback = new URL('/auth/callback', authConfig()!.NEXT_PUBLIC_SITE_URL);
      callback.searchParams.set('next', next);
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: callback.href },
      });
      return { error };
    },
    async verify(email, token) {
      const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
      return { error, userId: data.user?.id ?? null };
    },
    // 방금 로그인한 세션으로 닉네임이 있는지 본다. 조회 실패(undefined)는 "있음"으로 보고 막지 않는다.
    async hasNickname(userId) {
      return (await readNickname(client, userId)) !== null;
    },
    async logout() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      return { error };
    },
  };
}
