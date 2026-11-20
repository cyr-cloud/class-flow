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

// 가입 마무리 상태(LEGAL-04): 닉네임 + 지금 판 약관·처리방침·만 14세 동의. 하나라도 없으면 /me/nickname을 거친다.
export async function readConsentRows(client: SupabaseClient, userId: string): Promise<{ kind: string; version: string }[] | undefined> {
  const { data, error } = await client.from('user_consents').select('kind, version').eq('user_id', userId).eq('product', 'classflow');
  return error ? undefined : (data ?? []);
}

export async function recordConsents(client: SupabaseClient, termsVersion: string, privacyVersion: string): Promise<boolean> {
  const { data, error } = await client.rpc('record_consents', { p_product: 'classflow', p_terms_version: termsVersion, p_privacy_version: privacyVersion });
  return !error && data === true;
}

// 탈퇴(LEGAL-07). 'deleted' = 로그인 계정까지 지움, 'classflow_only' = 스토어 구매 기록 때문에 계정은 남기고 클래스플로우 정보만 지움.
export async function deleteMyAccount(client: SupabaseClient): Promise<'deleted' | 'classflow_only' | null> {
  const { data, error } = await client.rpc('delete_my_account');
  return !error && (data === 'deleted' || data === 'classflow_only') ? data : null;
}
