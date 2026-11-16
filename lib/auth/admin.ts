import 'server-only';
import { redirect } from 'next/navigation';
import { authConfig } from './config';
import { adminAccess, parseRoles, type AdminAccess, type Role } from './roles';
import { createUserClient } from '@/lib/supabase/server';

export interface AdminCheck {
  access: AdminAccess;
  userId: string | null;
  nickname: string | null;
  roles: Role[];
}

// 지금 사용자의 관리자 여부. 사용자 세션 클라이언트라 RLS로 본인 행만 읽는다.
export async function checkAdmin({ readOnly = true }: { readOnly?: boolean } = {}): Promise<AdminCheck> {
  const none: AdminCheck = { access: 'anonymous', userId: null, nickname: null, roles: [] };
  if (!authConfig()) return none;
  try {
    const client = await createUserClient({ readOnly });
    const { data } = await client.auth.getUser();
    if (!data.user) return none;
    const { data: row, error } = await client.from('profiles').select('display_name, roles').eq('id', data.user.id).maybeSingle();
    const roles = error ? null : parseRoles(row?.roles);
    return { access: adminAccess(data.user.id, roles), userId: data.user.id, nickname: row?.display_name ?? null, roles: roles ?? [] };
  } catch {
    return none;
  }
}

// 관리자 화면(서버 컴포넌트)용: 비로그인은 로그인 화면으로 보낸다. 관리자가 아니면 호출한 쪽이 안내를 보여준다.
export async function requireAdminPage(next = '/admin'): Promise<AdminCheck> {
  const check = await checkAdmin();
  if (check.access === 'anonymous') redirect('/login?next=' + encodeURIComponent(next));
  return check;
}

// 관리자 API용: 관리자가 아니면 돌려줄 응답을, 관리자면 null을 준다.
export async function adminApiGuard(): Promise<Response | null> {
  const check = await checkAdmin({ readOnly: false });
  if (check.access === 'anonymous') return Response.json({ message: '로그인이 필요해요.' }, { status: 401 });
  if (check.access === 'forbidden') return Response.json({ message: '관리자만 할 수 있어요.' }, { status: 403 });
  return null;
}
