import { checkAdmin } from '@/lib/auth/admin';
import { authConfig } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

// 상단 바 로그인 버튼용: 로그인 여부와 관리자 여부만 알려 준다(이메일·이름 등은 돌려주지 않는다).
// readOnly: false — 만료된 접근 토큰을 여기서 새로 고쳐 쿠키에 다시 써 둔다.
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!authConfig()) return Response.json({ enabled: false, signedIn: false, admin: false }, { headers });
  const { access } = await checkAdmin({ readOnly: false });
  return Response.json({ enabled: true, signedIn: access !== 'anonymous', admin: access === 'admin' }, { headers });
}
