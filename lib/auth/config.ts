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
