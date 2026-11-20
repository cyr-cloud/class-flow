// 이용약관·개인정보처리방침 판 번호와 가입 동의 규칙 (LEGAL-04·05).
// 문서를 바꾸면 판 번호를 올린다 → 다음에 올리기·댓글을 하려는 사람에게 다시 동의를 받는다.
// 지금 판은 초안이다(LEGAL-02·03에서 확정하고 전문가 검토 후 '-draft'를 뗀다).
export const TERMS_VERSION = '2026-11-20-draft';
export const PRIVACY_VERSION = '2026-11-20-draft';
export const MIN_SIGNUP_AGE = 14; // 클래스플로우는 만 14세 이상만 가입(2026-11-20 결정)

export interface ConsentInput { age14: boolean; terms: boolean; privacy: boolean }

// 세 가지가 모두 true여야 한다. 하나라도 빠지면 무엇이 빠졌는지 알려 준다.
export function checkConsents(value: unknown): { ok: true } | { ok: false; message: string } {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (v.age14 !== true) return { ok: false, message: `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있어요. 확인란을 체크해 주세요.` };
  if (v.terms !== true) return { ok: false, message: '이용약관에 동의해 주세요.' };
  if (v.privacy !== true) return { ok: false, message: '개인정보 수집·이용에 동의해 주세요.' };
  return { ok: true };
}

// 내가 동의한 판들 중에 지금 판이 모두 있는가
export function hasCurrentConsent(rows: { kind: string; version: string }[]): boolean {
  const has = (kind: string, version: string) => rows.some((r) => r.kind === kind && r.version === version);
  return has('age14', TERMS_VERSION) && has('terms', TERMS_VERSION) && has('privacy', PRIVACY_VERSION);
}
