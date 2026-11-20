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
- COURSE-ACCESS: 관리자 또는 강의 주인(강사) 권한 + 링크 공개(열쇠) migration 202611160005 실제 적용, 열쇠 검증·새 링크 만들기 확인 후 샘플 강의는 준비 중으로 되돌림. FIX-FORM-RESET: 저장 후 폼이 옛 값으로 돌아가던 버그 수정. 테스트 76개·스토어 DB 48개

## HOME-02·03 강의·차시 공개 페이지 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381b4ae5af38243612495

- (2026-11-20부터 노션 기록은 날짜 페이지 대신 기능 단위 페이지 + 처리 날짜로 남김 — 사용자 요청)
- /courses/[slug] 강의 소개·차시 목록, /courses/[slug]/[번호] 실습 안내 → 올리기(자리만) → 결과물(자리만) → 이전·다음
- 조회는 course_for_viewer·lessons_for_viewer, 볼 수 없으면 404. 링크 공개 열쇠를 차시 링크까지 유지, 공개 외 noindex. proxy matcher에 /courses 추가(세션 갱신)
- 관리 화면에 "학생 화면 미리보기" 링크
- 검증: 비회원 열쇠 없음/틀림 404·맞음 200, 없는 차시·01 404, 375px 넘침 없음, 관리자 준비 중 미리보기. 테스트 78개·tsc·eslint 통과. 샘플 강의 준비 중으로 복구
- 캡처: generated/worklog/HOME-02-03/ (3장, 노션 업로드)

## GAL-01a 결과물 갤러리 테이블·권한 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af53819f9e12f6d8043b0aad

- migration 202611200001_gallery.sql: posts·post_likes·comments·reports + RLS + 함수(create_post·delete_post·set_post_status·report_content·posts_for_viewer·comments_for_viewer·lesson_post_counts·purge_deleted_posts)
- 첫 테스트에서 좋아요 정책이 남의 글을 못 찾음(posts RLS) → post_is_visible 함수로 확인하도록 수정
- 스토어 DB 테스트 67개 통과, 실제 DB 적용. 비회원 REST: posts 표 42501, create_post 42501, purge 42501, 준비 중 강의 목록 []

## GAL-01b 결과물 이미지 올리기 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381a28b30c38e16600c77

- 버킷 gallery(202611200002) + 자기 폴더 읽기 정책(202611200003: 빼 버린 이미지가 안 지워지던 문제 수정)
- /api/gallery/images POST·DELETE, ImagePicker(Ctrl+V), /courses/[slug]/[n]/new, 차시 카드 기본형, 차시별 결과물 수
- 검증: 스토어 DB 73개, 앱 테스트 82개, tsc·eslint. 실제 업로드·차단(415·413·400·401·403) 확인. 샘플 결과물 1개 남김
- 캡처: generated/worklog/GAL-01b/ (3장, 노션 업로드)

## GAL-01c·08 링크 입력·미리보기·개인정보 안내 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af538121ad5dd93a3a507531

- 링크 0~3개(parseLink), 이미지·링크 중 하나 필수, 미리보기 카드, 개인정보 안내, 링크만 있는 결과물 카드
- 테스트 84개·tsc·eslint, 실제 저장(링크 2개) 확인, 375px 넘침 없음. 샘플 결과물 2차시에 1개 남김
- 노션 기능 페이지 제목에 날짜를 붙이기로 함(사용자 요청) → HOME-02·03, GAL-01a, GAL-01b 제목도 변경


## GAL-02 결과물 목록 정렬·더 보기 + 글만 올리기 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381f0925ce2f5fbd92407

- 차시 페이지 카드 목록: 최신순/인기순 탭, 24개씩 더 보기(주소 ?sort=&page=), 좋아요·댓글 수 표시
- 사용자 요청으로 글만 올리기 허용: 이미지·링크가 없으면 소개 필수(앱 parsePostInput + DB 202611200004, 실제 DB 적용)
- 검증: 앱 테스트 87개, 스토어 DB 74개, tsc·eslint. 실제 화면에서 글만 올리기 저장, 더 보기(쪽 크기 1로 임시 확인 후 24로 되돌림), 정렬 전환, 잘못된 주소값 기본값 처리, 375px 넘침 없음
- 샘플 결과물 2차시에 "구구단 출력기"(글만) 추가
- 캡처: generated/worklog/GAL-02/ (3장)

## GAL-상세 결과물 상세 페이지 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af53817cbaace3dae62f7213

- /courses/[slug]/[n]/posts/[id]: 이미지 크게(누르면 원본), 소개 전문, 링크 목록, 날짜, 좋아요·댓글 수, 숨긴 내 글 안내
- 목록 카드 전체를 상세 링크로(링크만 있는 카드의 바깥 링크는 상세에서 열기)
- 검증: 앱 테스트 88개, tsc·eslint. 이미지·링크·글만 결과물 상세 화면 확인, 다른 차시·잘못된 id·대문자 id·없는 글·없는 강의 404, 375px 넘침 없음
- 캡처: generated/worklog/GAL-detail/ (3장)

## GAL-03 좋아요 · 2026-11-20 · 노션: (작성 중)

- app/courses/actions.ts setLike, components/gallery/LikeButton.tsx, 상세 페이지 연결, 목록 카드 ♥/♡ 표시
- 검증: 앱 테스트 88개, tsc·eslint. 실제 화면: 누르기(0→1) → 새로고침 유지 → 인기순 맨 위 → 취소(1→0) → 새로고침 유지
- 남은 것: 로그아웃 상태 로그인 안내는 샘플 강의가 준비 중이라 화면 확인 못 함(코드상 /login?next=상세주소). DB의 post_is_visible은 강의 공개 여부까지는 보지 않음 — 앱은 setLike에서 확인하지만 REST로 직접 넣으면 글 id를 알 때 좋아요가 가능(숫자만 바뀜)
- 캡처: generated/worklog/GAL-03/ (1장)
