// 공용 profiles.roles (yuco-store/server/supabase/migrations/202611160002_profiles_roles.sql)
// 역할은 사용자가 스스로 못 바꾼다. 부여·회수는 서버(service_role)나 SQL로만.
export const ROLES = ['student', 'instructor', 'operator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// DB에서 온 값을 믿지 않고 알려진 역할만 남긴다.
export function parseRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r));
}

export function hasRole(roles: readonly string[], wanted: Role): boolean {
  return roles.includes(wanted);
}

export type AdminAccess = 'anonymous' | 'forbidden' | 'admin';

// 관리자 화면·API 공통 판정. 프로필 조회 실패(null)는 관리자로 보지 않는다(닫힌 쪽으로 실패).
export function adminAccess(userId: string | null, roles: readonly string[] | null): AdminAccess {
  if (!userId) return 'anonymous';
  return roles && hasRole(roles, 'admin') ? 'admin' : 'forbidden';
}
