// 네이버 회원 프로필 응답(https://openapi.naver.com/v1/nid/me)을
// Supabase 사용자 지정 OAuth 공급자가 기대하는 표준 userinfo 형태로 바꾼다.
//
// 네이버 응답: { resultcode: "00", message: "success", response: { id, email, name, nickname, profile_image, ... } }
// 표준 형태:   { sub, email, email_verified, name, nickname, picture }
//
// email_verified는 메일이 있을 때 true로 넘긴다(2026-11-16 결정).
// false로 두면 Supabase "Confirm email" 설정 때문에 로그인이 422(Unverified email)로 막힌다.
// 네이버가 확인한 회원 메일로 보고, 같은 메일의 구글·이메일 계정과는 한 계정으로 합쳐진다.
// 계정 식별 자체는 네이버 고유 id(sub)로 한다.

export interface NaverMeResponse {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
}

export interface StandardUserInfo {
  sub: string;
  email?: string;
  email_verified: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
}

export function mapNaverProfile(body: NaverMeResponse): StandardUserInfo | null {
  if (!body || body.resultcode !== '00' || !body.response) return null;
  const r = body.response;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const picture = text(r.profile_image);
  const email = text(r.email)?.toLowerCase();
  return {
    sub: r.id,
    email,
    email_verified: Boolean(email),
    name: text(r.name) ?? text(r.nickname),
    nickname: text(r.nickname),
    picture: picture && /^https:\/\//.test(picture) ? picture : undefined,
  };
}
