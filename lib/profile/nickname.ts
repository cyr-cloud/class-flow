// 갤러리·채팅에 보일 닉네임 규칙 (AUTH-03).
// DB(profiles_display_name_shape)도 2~20자·앞뒤 공백 없음을 검사한다. 여기는 그보다 엄격하게 거른다.

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

// 운영자·강사로 오해할 수 있는 이름은 막는다(대소문자·공백 무시, 포함 여부로 판단).
const RESERVED = ['관리자', '운영자', '운영팀', 'admin', 'administrator', '유니크코딩', 'yuniqcoding', 'classflow', '클래스플로우'];

export type NicknameResult = { ok: true; value: string } | { ok: false; message: string };

export function normalizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function checkNickname(raw: unknown): NicknameResult {
  const value = normalizeNickname(raw);
  const length = [...value].length;
  if (length < NICKNAME_MIN) return { ok: false, message: `닉네임은 ${NICKNAME_MIN}자 이상으로 적어주세요.` };
  if (length > NICKNAME_MAX) return { ok: false, message: `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.` };
  // \p{L} 같은 유니코드 속성 정규식은 빌드 변환에서 깨질 수 있어 범위를 직접 쓴다(한글 음절·자모, 영문, 숫자).
  if (!/^[가-힣ㄱ-ㆎa-zA-Z0-9 ._-]+$/.test(value)) return { ok: false, message: '한글·영문·숫자와 공백, 점(.), 밑줄(_), 하이픈(-)만 쓸 수 있어요.' };
  if (!/[가-힣ㄱ-ㆎa-zA-Z0-9]/.test(value)) return { ok: false, message: '글자나 숫자를 하나 이상 넣어주세요.' };
  const squashed = value.toLowerCase().replace(/[\s._-]/g, '');
  if (RESERVED.some((word) => squashed.includes(word))) return { ok: false, message: '운영자로 오해할 수 있는 이름은 쓸 수 없어요.' };
  return { ok: true, value };
}

// 소셜 로그인이 준 별명·이름으로 입력칸을 미리 채운다. 규칙에 안 맞으면 빈칸.
export function suggestNickname(meta: Record<string, unknown> | null | undefined): string {
  for (const key of ['nickname', 'name', 'full_name']) {
    const result = checkNickname(meta?.[key]);
    if (result.ok) return result.value;
  }
  return '';
}

// 닉네임이 없으면 로그인 직후 닉네임 화면을 거쳐 원래 가려던 곳으로 간다.
export function nicknameSetupPath(next: string): string {
  return '/me/nickname?next=' + encodeURIComponent(next);
}
