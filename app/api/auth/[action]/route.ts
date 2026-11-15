import { authConfig } from '@/lib/auth/config';
import { authProvider } from '@/lib/auth/provider';
import { requestCode, verifyCode } from '@/lib/auth/service';

export const dynamic = 'force-dynamic';

const ACTIONS = ['request', 'verify', 'logout'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!ACTIONS.includes(action as Action)) return Response.json({ message: '찾을 수 없는 요청입니다.' }, { status: 404 });

  // 다른 사이트에서 보낸 요청(CSRF)을 막는다.
  const origin = request.headers.get('origin');
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  if (!origin || origin !== expectedOrigin) return Response.json({ message: '사이트에서 다시 시도해주세요.' }, { status: 403 });

  if (!authConfig()) return Response.json({ message: '로그인 서비스를 준비 중입니다. 잠시 후 다시 방문해주세요.' }, { status: 503 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ message: '잘못된 요청입니다.' }, { status: 415 });

  try {
    const raw = await request.text();
    if (raw.length > 2048) return Response.json({ message: '요청이 너무 큽니다.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ message: '입력을 확인해주세요.' }, { status: 400 });

    const provider = await authProvider();
    if (action === 'logout') {
      const { error } = await provider.logout();
      return Response.json({ message: error ? '로그아웃하지 못했습니다. 다시 시도해주세요.' : '로그아웃했어요.' }, { status: error ? 503 : 200 });
    }
    const result = action === 'request' ? await requestCode(provider, body.email, body.next) : await verifyCode(provider, body);
    return Response.json(result.body, { status: result.status, headers: result.status === 429 ? { 'Retry-After': '60' } : undefined });
  } catch {
    return Response.json({ message: '요청을 처리하지 못했습니다. 입력을 확인하고 다시 시도해주세요.' }, { status: 400 });
  }
}
