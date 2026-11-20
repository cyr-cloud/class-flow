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

## GAL-03 좋아요 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381f1b00dd77ee78e84a3

- app/courses/actions.ts setLike, components/gallery/LikeButton.tsx, 상세 페이지 연결, 목록 카드 ♥/♡ 표시
- 검증: 앱 테스트 88개, tsc·eslint. 실제 화면: 누르기(0→1) → 새로고침 유지 → 인기순 맨 위 → 취소(1→0) → 새로고침 유지
- 남은 것: 로그아웃 상태 로그인 안내는 샘플 강의가 준비 중이라 화면 확인 못 함(코드상 /login?next=상세주소). DB의 post_is_visible은 강의 공개 여부까지는 보지 않음 — 앱은 setLike에서 확인하지만 REST로 직접 넣으면 글 id를 알 때 좋아요가 가능(숫자만 바뀜)
- 캡처: generated/worklog/GAL-03/ (1장)

## GAL-04 댓글 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af53813199b2e62abe29169e

- 첫 공개에 댓글 포함(사용자 결정). components/gallery/Comments.tsx, addComment·deleteComment, commentsForViewer, parseComment
- DB 202611200005: 댓글 닉네임 필수(정책), 하루 50개(BEFORE INSERT 트리거 + 사람별 잠금). 스토어 DB 테스트 77개, 실제 DB 적용
- 검증: 앱 테스트 89개, tsc·eslint. 실제 화면: 쓰기 → 목록·수 반영, 지우기, 301자 버튼 꺼짐, 목록 카드 💬 1, 375px 넘침 없음
- 샘플 댓글 1개 남김(2차시 구구단 출력기)
- 캡처: generated/worklog/GAL-04/ (1장)

## GAL-05 본인 수정·삭제 + 정리 작업 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381058020f73eb6916097

- 고치기: app/courses/[slug]/[lesson]/posts/[postId]/edit, NewPostForm edit 모드, ImagePicker initial(기존 이미지는 빼도 바로 안 지움), lib/gallery/store updatePost
- 지우기: DeletePostButton → deletePost(delete_post RPC) → 차시 페이지 deleted=1 안내
- 정리 작업: lib/gallery/cleanup.ts, lib/gallery/cron.ts, app/api/cron/gallery-cleanup, vercel.json(매일 18:00 UTC), DB 202611200006(gallery_orphan_images, images GIN 색인) 실제 적용, 스토어 DB 테스트 79개
- 검증: 앱 테스트 90개, tsc·eslint. 실제 화면: 고치기(제목·링크 추가 저장) → 저장 안내, 테스트 결과물 올리고 지우기 → 안내·목록에서 사라짐, 지운 글 상세·고치기 404, 수정 중 이미지 빼고 취소해도 파일 그대로(200), 정리 주소 비밀값 없거나 틀리면 401
- 남은 것: SUPABASE_SERVICE_ROLE_KEY·CRON_SECRET이 아직 없어서 정리 작업 실제 실행은 못 함. Vercel 환경 변수 등록 후 1회 실행 확인 필요
- 캡처: generated/worklog/GAL-05/ (1장)

## GAL-07 한 차시 하루 3개 제한 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af538176bab6f06f5e865eb7

- DB 202611200007 my_posts_today(실제 적용, 스토어 DB 테스트 81개). 앱: DAILY_POST_LIMIT·postsLeftToday, myPostsToday, 올리기 화면 남은 개수·다 쓰면 안내, 막혔을 때 메시지에 "지운 결과물도 세요"
- 검증: 앱 테스트 91개, tsc·eslint. 실제 화면: 2차시 "오늘 1개 더" → 3개째 올림 → 폼 대신 안내 → 테스트 결과물 지워도 계속 막힘
- 함께 처리(GAL-05 보완): 다른 계정 소유 테스트 결과물을 실제 DB에 넣고 관리자 화면에서 고치기·결과물 지우기 버튼 없음, 고치기 주소 404 확인 후 그 결과물 삭제
- 캡처: generated/worklog/GAL-07/ (1장), generated/worklog/GAL-05/02-other-user-post.jpg

## GAL-06 신고 → 자동 숨김 → 관리자 알림 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af53810ca94ce6e6e7e9171a

- components/gallery/ReportButton.tsx(결과물·댓글), reportContent, parseReport·REPORT_REASONS, 관리자 첫 화면 신고 알림 패널(adminReportAlerts)
- DB 202611200008 admin_report_alerts(관리자 전용, 실제 적용, 스토어 DB 테스트 83개)
- 검증: 앱 테스트 92개, tsc·eslint. 실제 화면: 다른 계정 소유 테스트 결과물·댓글을 넣고 신고(개인정보 노출+내용, 스팸) → 접수 안내 → 관리자 패널 2건(1/3) → 결과물을 숨김 상태로 바꿔 "자동 숨김" 표시·맨 위 정렬 확인 → 테스트 데이터(신고 2·댓글 1·결과물 1) 삭제
- 3명 자동 숨김 자체는 계정이 2개뿐이라 DB 테스트로 확인
- 캡처: generated/worklog/GAL-06/ (2장)

## ADM-02 신고 처리 · 업로드 정지 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381c4b4f7fa4e1b8ff9dd

- /admin/reports(app/admin/reports/page.tsx·ui.tsx·actions.ts), 관리자 첫 화면 "신고 처리하러 가기", 학생 화면 정지 안내(올리기·고치기·댓글), 이미지 올리기 403
- DB 202611200009 실제 적용, 스토어 DB 테스트 90개
- 검증: 앱 테스트 92개, tsc·eslint. 실제 화면: 테스트 신고 4건(숨겨진 결과물·댓글·결과물 2) → 다시 보이기·댓글 숨기기·문제없음·지우기 → DB 상태 확인(visible·hidden·visible·deleted, 열린 신고 0) → 글쓴이 7일 정지 → 정지 목록 → 풀기. 관리자 계정을 DB에서 잠깐 정지해 학생 화면 안내·이미지 403·좋아요는 됨 확인 후 해제. 테스트 데이터(신고 4·댓글 1·결과물 3) 삭제
- 캡처: generated/worklog/ADM-02/ (3장)

## GAL-검증 갤러리 권한 점검 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af538198a5a6f47c4046f3c0

- 실제 DB(yuco-store-dev)에서 DO 블록 하나로 비회원·일반 학생·신고 3명을 흉내 내 21개 항목 확인, 마지막 예외로 전부 되돌림. 이후 강의 draft·결과물 visible/0·신고 0·사용자 2명 그대로인 것 확인
- 발견: 지금 있는 두 계정이 모두 admin 역할 → "다른 계정"으로 시험하면 관리자 권한이라 지우기·숨기기가 됨(정상). 일반 학생 확인은 임시 사용자로 함
- 로그아웃 HTTP 확인: 준비 중 강의 페이지 404, 이미지 올리기 401, 정리 작업 401, /admin/reports는 로그인으로
- 남은 것: GAL-검증b(공개 강의가 생기면 로그아웃 화면 눈으로 확인)
- 점검 스크립트: yuco-store/server/supabase/checks/gal_verify.sql

## LEGAL 법적 점검 태스크 추가 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af538195b93cc42271e897fb

- 공통 점검표 ~/.claude/skills/project-workflow-log/references/legal-checklist.md (개인정보·약관·사용자 콘텐츠·판매·외부 자료·기타, 강의 판매 시 환불 안내 필수)
- ClassFlow docs/development-checklist.md 1-7 LEGAL-01~09, yuco-store TASKS.md LEGAL-03~05, ai-trend-researcher TASKS.md LEGAL-01
- 공통 규칙: ~/.claude/CLAUDE.md "프로덕트마다 법적 점검(LEGAL) 태스크를 넣는다", project-workflow-log SKILL.md 2-1단계

## LEGAL-04·05 가입 동의 · 만 14세 이상 · 약관·처리방침 초안 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381f0a484d85145811ca7

- 만 14세 이상만 가입(사용자 결정). 닉네임 화면 필수 체크 3개 + /api/profile/nickname이 지금 판 동의가 없으면 세 가지 모두 받아야 저장
- DB 202611200010 user_consents·record_consents·has_consented·require_classflow_consent 트리거(P0005), 실제 적용, 스토어 DB 테스트 94개
- /terms·/privacy 초안(초안 표시, [확인 필요] 부분 남김), 푸터 링크, lib/legal/documents.ts 판 번호
- 가입 확인 게이트: 로그인 콜백·올리기·고치기·댓글 → signupState(닉네임+지금 판 동의)
- 검증: 앱 테스트 94개, tsc·eslint. 실제 화면: 동의 없는 관리자 계정이 올리기 → 동의 화면(체크 0, 버튼 꺼짐) → API 직접 호출(동의 없음·일부·문자열 true) 모두 400 → 모두 동의 후 저장 → 올리기 화면으로 복귀 → DB 3줄 기록, 375px 넘침 없음
- 캡처: generated/worklog/LEGAL-04-05/ (3장)

## LEGAL-07 탈퇴 · 2026-11-20 · 노션: https://www.notion.so/41eabd06af5381caacece88432f4c280

- DB 202611200011 delete_my_account(구매 기록 없으면 auth.users 삭제 → 연결 데이터 cascade, 있으면 ClassFlow 정보만), 스토어 DB 테스트 99개, 실제 적용
- /me/delete(설명 + "탈퇴합니다" 입력), /api/profile/delete(Origin·문구·로그인 → 내 이미지 삭제 → 함수 → 로그아웃), 마이페이지 링크, 약관·처리방침 탈퇴 문구
- 검증: 앱 테스트 95개, tsc·eslint. 실제 DB에서 임시 사용자 탈퇴 → auth.users·profiles·동의 0줄 확인 후 되돌림(사용자 2명 그대로). 로그아웃 상태 HTTP: 탈퇴 화면 → 로그인, 다른 Origin 403, 문구 틀림 400, 문구 맞음·로그인 없음 401
- 못 한 것: 브라우저 로그인 세션이 끝나 있어서 탈퇴 화면을 눈으로 확인하지 못함(LEGAL-07b)
- (보완) 다시 로그인한 뒤 탈퇴 화면 확인: 마이페이지 링크, 문구 비면·일부면 버튼 꺼짐·정확하면 켜짐, 로그인 상태 문구 틀림 400, 375px 넘침 없음. 실제 탈퇴는 누르지 않음. 캡처 generated/worklog/LEGAL-07/
