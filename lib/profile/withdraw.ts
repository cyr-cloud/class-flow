// 탈퇴 확인 문구(LEGAL-07). 실수로 누르지 않게 직접 입력하게 한다.
export const WITHDRAW_PHRASE = '탈퇴합니다';

export function checkWithdrawPhrase(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === WITHDRAW_PHRASE;
}
