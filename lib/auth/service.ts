// node --test가 바로 읽을 수 있게 확장자를 붙인다 (tsconfig allowImportingTsExtensions).
import { emailSchema, codeSchema, safeReturnPath } from './input.ts';
import { nicknameSetupPath } from '../profile/nickname.ts';

type ProviderError = { code?: string; status?: number } | null;

// Supabase 호출을 이 인터페이스 뒤로 숨겨, 입력 검사·응답 문구를 네트워크 없이 시험할 수 있게 한다.
export interface AuthProvider {
  send(email: string, next: string): Promise<{ error: ProviderError }>;
  verify(email: string, token: string): Promise<{ error: ProviderError; userId: string | null }>;
  hasNickname?(userId: string): Promise<boolean>;
  logout(): Promise<{ error: ProviderError }>;
}

export async function requestCode(provider: AuthProvider, email: unknown, next: unknown) {
  const p = emailSchema.safeParse(email);
  if (!p.success) return { status: 400, body: { message: '이메일 주소를 확인해주세요.' } };
  const { error } = await provider.send(p.data, safeReturnPath(next));
  if (error) {
    const limited = error.status === 429;
    return {
      status: limited ? 429 : 503,
      body: { message: limited ? '요청이 많습니다. 잠시 후 다시 시도해주세요.' : '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.' },
    };
  }
  return { status: 200, body: { message: '인증 메일을 보냈어요. 받은편지함과 스팸함을 확인해주세요.', retryAfter: 60 } };
}

export async function verifyCode(provider: AuthProvider, input: { email?: unknown; token?: unknown; next?: unknown }) {
  const e = emailSchema.safeParse(input.email);
  const t = codeSchema.safeParse(input.token);
  if (!e.success || !t.success) return { status: 400, body: { message: '이메일과 메일에 적힌 인증번호를 확인해주세요.' } };
  const result = await provider.verify(e.data, t.data);
  // 연결 실패·서버 오류(상태 없음/0/5xx)를 "번호가 틀렸다"로 보이지 않게 따로 알린다.
  const s = result.error?.status;
  if (result.error && (!s || s >= 500)) {
    return { status: 503, body: { message: '로그인 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.' } };
  }
  if (result.error || !result.userId) {
    const limited = result.error?.status === 429;
    return {
      status: limited ? 429 : 400,
      body: { message: limited ? '시도가 많습니다. 잠시 후 다시 시도해주세요.' : '인증번호가 올바르지 않거나 만료됐어요. 새 번호를 받아주세요.' },
    };
  }
  const next = safeReturnPath(input.next);
  const named = provider.hasNickname ? await provider.hasNickname(result.userId) : true;
  return { status: 200, body: { message: '로그인했어요.', next: named ? next : nicknameSetupPath(next) } };
}
