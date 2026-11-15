// 네이버 회원 프로필 응답(https://openapi.naver.com/v1/nid/me)을
// Supabase 사용자 지정 OAuth 공급자가 기대하는 표준 userinfo 형태로 바꾼다.
//
// 네이버 응답: { resultcode: "00", message: "success", response: { id, email, name, nickname, profile_image, ... } }
// 표준 형태:   { sub, email, email_verified, name, nickname, picture }
//
// email_verified는 false로 둔다. 네이버의 email은 회원이 등록한 연락처 메일이라 Supabase가
// 같은 메일의 다른 계정(구글·이메일 로그인)과 자동으로 합치면 남의 계정에 들어갈 위험이 있다.
// 계정 식별은 네이버 고유 id(sub)로 한다.

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
  return {
    sub: r.id,
    email: text(r.email)?.toLowerCase(),
    email_verified: false,
    name: text(r.name) ?? text(r.nickname),
    nickname: text(r.nickname),
    picture: picture && /^https:\/\//.test(picture) ? picture : undefined,
  };
}
