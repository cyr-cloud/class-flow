// Supabase Edge Function: 네이버 userinfo 변환기.
// Supabase 대시보드의 사용자 지정 공급자 "custom:naver"에서 UserInfo URL을
//   https://<프로젝트>.supabase.co/functions/v1/naver-userinfo
// 로 지정하면, Supabase가 네이버 access token을 Authorization 헤더에 담아 이 함수를 부른다.
// 이 함수는 네이버 프로필을 받아 표준 userinfo(JSON)로 바꿔 돌려준다.
//
// 배포: supabase functions deploy naver-userinfo --no-verify-jwt
// (--no-verify-jwt: Supabase 사용자 JWT가 아니라 네이버 토큰으로 호출되기 때문)
// 세 사이트(스토어·클래스플로우·강사풀)가 같은 Supabase 프로젝트를 쓰므로 한 번만 배포한다.

import { mapNaverProfile } from './map.ts';

const NAVER_ME = 'https://openapi.naver.com/v1/nid/me';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer\s+\S+$/i.test(auth) || auth.length > 4096) return Response.json({ error: 'invalid_token' }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(NAVER_ME, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
  if (upstream.status === 401) return Response.json({ error: 'invalid_token' }, { status: 401 });
  if (!upstream.ok) return Response.json({ error: 'upstream_error' }, { status: 502 });

  const info = mapNaverProfile(await upstream.json().catch(() => null));
  if (!info) return Response.json({ error: 'invalid_profile' }, { status: 502 });
  return Response.json(info, { headers: { 'Cache-Control': 'no-store' } });
});
