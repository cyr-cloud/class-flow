import { adminApiGuard } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

// 관리자 API 보호 확인용. 이후 /api/admin/* 는 모두 adminApiGuard()로 시작한다.
export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  return Response.json({ admin: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
