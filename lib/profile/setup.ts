import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCurrentConsent } from '@/lib/legal/documents';
import { readConsentRows, readNickname } from './store';

// 가입을 마쳤는가: 닉네임이 있고 지금 판에 동의했는가(LEGAL-04·05). 조회가 실패하면 "모름"이라 막지 않는다(DB가 다시 막는다).
export async function signupState(client: SupabaseClient, userId: string): Promise<{ nickname: string | null | undefined; consented: boolean; complete: boolean }> {
  const [nickname, rows] = await Promise.all([readNickname(client, userId), readConsentRows(client, userId)]);
  const consented = rows === undefined ? true : hasCurrentConsent(rows);
  return { nickname, consented, complete: nickname !== null && consented };
}
