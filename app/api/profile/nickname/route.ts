import { authConfig } from '@/lib/auth/config';
import { safeReturnPath } from '@/lib/auth/input';
import { checkNickname } from '@/lib/profile/nickname';
import { saveNickname } from '@/lib/profile/store';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 닉네임 저장 (AUTH-03). 본인 행만 쓸 수 있는 건 DB(RLS·열 권한)가 보장한다.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  if (!origin || origin !== expectedOrigin) return Response.json({ message: '사이트에서 다시 시도해주세요.' }, { status: 403 });
  if (!authConfig()) return Response.json({ message: '로그인 서비스를 준비 중입니다.' }, { status: 503 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ message: '잘못된 요청입니다.' }, { status: 415 });

  let body: { nickname?: unknown; next?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 1024) return Response.json({ message: '요청이 너무 큽니다.' }, { status: 413 });
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
  } catch {
    return Response.json({ message: '입력을 확인해주세요.' }, { status: 400 });
  }

  const checked = checkNickname(body.nickname);
  if (!checked.ok) return Response.json({ message: checked.message }, { status: 400 });

  try {
    const client = await createUserClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return Response.json({ message: '로그인이 끝났어요. 다시 로그인해주세요.' }, { status: 401 });
    if (!(await saveNickname(client, data.user.id, checked.value))) {
      return Response.json({ message: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
    }
    return Response.json({ message: '저장했어요.', nickname: checked.value, next: safeReturnPath(body.next) });
  } catch {
    return Response.json({ message: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
}
