import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import type { AuthProvider } from './service';
import { authConfig } from './config';

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
    async logout() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      return { error };
    },
  };
}
