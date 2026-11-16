// 공용 profiles 테이블(스토어·클래스플로우·강사풀)의 닉네임 읽기·쓰기.
// 사용자 세션 클라이언트로 부르므로 RLS가 "본인 행만"을 보장한다.
// 스키마: yuco-store/server/supabase/migrations (202611160001_profiles_nickname.sql)
import type { SupabaseClient } from '@supabase/supabase-js';

// 닉네임(없으면 null). 조회 자체가 실패하면 undefined — 호출한 쪽에서 "모름"으로 다룬다.
export async function readNickname(client: SupabaseClient, userId: string): Promise<string | null | undefined> {
  const { data, error } = await client.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) return undefined;
  return data?.display_name ?? null;
}

// 행이 있으면 고치고, 없으면 만든다. (upsert는 id 열 수정 권한이 필요해서 쓰지 않는다)
export async function saveNickname(client: SupabaseClient, userId: string, nickname: string): Promise<boolean> {
  const updated = await client.from('profiles').update({ display_name: nickname }).eq('id', userId).select('id');
  if (updated.error) return false;
  if (updated.data.length > 0) return true;
  const inserted = await client.from('profiles').insert({ id: userId, display_name: nickname });
  if (!inserted.error) return true;
  if (inserted.error.code !== '23505') return false;
  // 거의 동시에 다른 탭이 행을 만든 경우: 한 번 더 고친다.
  const retry = await client.from('profiles').update({ display_name: nickname }).eq('id', userId);
  return !retry.error;
}
