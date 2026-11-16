# WORKLOG

## 2026-11-15 · 노션: https://www.notion.so/419abd06af5381f6a785ed349ffda58e

- REPO-01~03: Desktop·OneDrive로 쪼개진 저장소를 `class-flow-merged`로 합침. npm ci·tsc·테스트 45개·로컬 화면·test-insert-slides 통과. 커밋 d7f3756 96569a0 8140b5b
- DECIDE-01: 갤러리 이미지 = Supabase Storage
- AUTH-01: 스토어 공용 Supabase 이메일 로그인(/login·/api/auth·/auth/callback·/me). 커밋 ebd4396. 실제 메일 로그인 미확인
- AUTH-05: 구글·네이버(custom:naver + naver-userinfo 함수) 코드. 테스트 54개. 커밋 0d0fa93. 설정 플래그 0
- SUPA-01: yuco-store-dev 일시정지 → 재개 후 연결 확인. 연결 실패 503 구분. 커밋 5c6a769
- SUPA-02: 기본 메일 한도 시간당 2통 → Custom SMTP 대기
- GOOGLE-01: Google Cloud `yuniqcoding-auth`, 동의 화면(유니크코딩·외부) 입력. 약관 동의는 사용자 대기
- 캡처: generated/worklog/2026-11-15/{AUTH-01,AUTH-05,SUPA-01,GOOGLE-01} → 노션 업로드·되읽기 확인(이미지 6개)
- GOOGLE-01 완료: OAuth 웹 클라이언트·Supabase Google 공급자·Redirect URL(127.0.0.1:3311/**) 설정, AUTH_GOOGLE_ENABLED=1, 사용자 실제 구글 로그인 → /me 확인. 동의 화면은 "테스트 중"(게시는 공개 도메인 후). 캡처 3장 추가(이메일 가림) → 노션 업로드

## 2026-11-16 · 노션: https://www.notion.so/41aabd06af5381b9a893e6eb514d35c9

- NAVER-01(AUTH-05n): 네이버 개발자센터 앱(이메일 필수·별명/사진 추가, 콜백=Supabase) + Supabase `custom:naver`(수동 구성, userinfo=naver-userinfo) + AUTH_NAVER_ENABLED=1
- 첫 로그인 422 Unverified email → naver-userinfo가 메일 있으면 email_verified=true(사용자 결정, 같은 메일 계정과 연결) → 테스트 54개 통과·재배포
- 실패 때 생긴 이메일 없는 네이버 계정 삭제(사용자 승인) → 재로그인 시 기존 이메일 계정에 네이버 연결(Providers: Naver, Email)
- /me: 이메일 대체 표시 + 로그인 방법 표시. tsc·eslint 통과
- 캡처: generated/worklog/2026-11-16/NAVER-01 (이메일·UID 가림) → 노션 업로드·되읽기 확인(이미지 4개)
- 남은 제약: 네이버 앱 "개발 중"(검수 전 본인 계정만), 구글 동의 화면 "테스트 중" → 운영 도메인 후 AUTH-05g-pub·AUTH-05n-pub
- AUTH-03: 첫 로그인 닉네임(/me/nickname, POST /api/profile/nickname, 로그인 직후 이동). 공용 profiles에 본인 닉네임 쓰기 권한 migration(yuco-store/server/supabase/migrations/202611160001) → 실제 DB 적용·정책/권한 확인. 테스트 63개 + 스토어 DB 28개 통과. 사용자 실제 저장 → /me "리베타님". 캡처 2장 → 노션 같은 날짜 페이지
- AUTH-04: profiles.roles(student 기본, 사용자 수정 불가) + has_role() migration(yuco-store/.../202611160002) 실제 적용. /admin 보호(레이아웃+page), /api/admin/check 가드, /me 관리자 버튼. 비로그인 307/401, 비관리자 안내/403, 관리자 200 확인. 본인 두 계정 admin 부여. 테스트 67개 + 스토어 DB 33개. 캡처 2장 → 노션
- COURSE-01a/01b/02/검증: courses·lessons migration(yuco-store/.../202611160003, 스토어 DB 39개) 실제 적용. /admin/courses 목록·새 강의·수정·삭제, 차시 추가·↑↓·실습 안내 마크다운 미리보기. 샘플 "도파민 Python"(준비 중)+차시 3개 등록. 테스트 74개·tsc·eslint. 캡처 3장 → 노션. 남은 것: 공개 페이지 HOME-02/03, 이미지 업로드, 비로그인 /admin/courses → 로그인 후 /admin으로 돌아옴
- COURSE-OWNER: courses.owner_id(기본 auth.uid(), on delete set null) migration 202611160004 실제 적용, 샘플 강의 주인 = 리베타 계정. 스토어 DB 41개·테스트 74개·tsc 통과
