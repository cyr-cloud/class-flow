# ClassFlow · 사용자가 할 일 (버전 순서)

업데이트: 2026-11-24. 버전 계획은 `docs/development-checklist.md`의 "버전 계획". 비밀번호·키·인증번호는 채팅에 보내지 말고 각 사이트에 직접 넣는다.

> 버전마다 순서: **제가 개발·배포 → 유라님이 "직접 확인 체크리스트"(노션)로 확인 → "통과"라고 말해 주면 다음 버전**.
> 아래는 각 버전을 내보내기 **전에** 유라님이 해 주셔야 하는 일이에요.

## v0.9 운영 합치기 — 강의는 준비 중이라 학생에게 안 보여요

### 도메인 (LAUNCH-G1) — 새로 살 필요 없음
- [x] `yuniq-coding.shop`은 이미 사 둔 상태(사용자 확인, 2026-11-20). 네임서버가 Vercel(ns1·ns2.vercel-dns.com)이고 지금 `www.yuniq-coding.shop`으로 연결돼 있어요.
- 세 사이트는 **한 도메인의 하위 주소**를 써요(무료). 스토어 `yuniq-coding.shop` · 클래스플로우 `class.yuniq-coding.shop` · 강사풀 `pool.yuniq-coding.shop`
- [x] `class.yuniq-coding.shop` 연결(2026-11-25). 도메인은 rkdldk37 계정 `yuniqcodings-projects`에 있어서 그 DNS에 CNAME `class`·TXT `_vercel`을 넣고 yuco `class-flow`에서 확인. https 200

### 운영 DB (OPS)
- [x] 운영용 Supabase `classflow-prod`(ref `xytojvrpsksavwjfhwwh`, Seoul) 만듦(2026-11-25). 무료 자리 때문에 `my-service`는 정지(1년 안에 다시 켤 수 있음). 마이그레이션 23개는 제가 넣음
  - v1.0 공개 전에 Pro 업그레이드 여부 결정(무료는 일주일 접속 없으면 자동 정지될 수 있음)
- [x] Vercel `yuco` 팀 → `class-flow` 환경 변수 7개(2026-11-25, 공개용 5개 Config·Production+Preview, 비밀 2개 Secret·Production):
  - `NEXT_PUBLIC_SITE_URL` = `https://class.yuniq-coding.shop`, `NEXT_PUBLIC_SUPABASE_URL` = `https://xytojvrpsksavwjfhwwh.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(classflow-prod → Settings → API Keys의 publishable 키)
  - `AUTH_GOOGLE_ENABLED=1`, `AUTH_NAVER_ENABLED=1`
  - `SUPABASE_SERVICE_ROLE_KEY`(classflow-prod → Settings → API Keys의 secret 키, 절대 공개 금지)
  - `CRON_SECRET`(16자 이상 아무 무작위 문자열) — 매일 정리 작업이 이걸로 돌아요
- [ ] classflow-prod → Authentication → URL Configuration: Site URL = `https://class.yuniq-coding.shop`, Redirect URLs에 `https://class.yuniq-coding.shop/auth/callback` 추가
- [ ] 구글: Google Cloud `yuniqcoding-auth` → OAuth 클라이언트 → 승인된 리디렉션 URI에 `https://xytojvrpsksavwjfhwwh.supabase.co/auth/v1/callback` 추가 → classflow-prod → Authentication → Sign In / Providers → Google 켜고 같은 클라이언트 ID·secret 넣기
- [ ] 네이버: 네이버 개발자센터 앱 → Callback URL에 `https://xytojvrpsksavwjfhwwh.supabase.co/auth/v1/callback` 추가 → classflow-prod에 사용자 지정 공급자 `naver`를 개발 DB와 같은 값으로 만들기
- [x] Vercel `class-flow` 도메인 추가(위 도메인 칸과 같은 일)

### 배포 뒤
- [ ] **v0.9 직접 확인 체크리스트**(노션으로 드려요) 확인 → "통과"

## v1.0 갤러리 첫 공개 — 학생이 링크·QR로 들어와 올리는 단계

### 약관·처리방침 빈칸 (LEGAL-01·02·03·06 → 09)
`/terms`, `/privacy` 초안의 **[확인 필요]**를 정해 주시면 제가 문구를 고쳐요. 추천값을 같이 적었어요.
- [ ] 운영자: 유코스토어와 같은 사업자(상호·대표·사업자번호)로 할지 → 추천: 같은 사업자
- [ ] 개인정보 보호책임자: 이름(대표 본인 가능)과 연락용 이메일
- [ ] 문의·권리 침해 신고 받을 이메일 하나(공개용, 개인 메일과 분리 추천)와 처리 기간 → 추천: 접수 후 3일 안에 임시 숨김, 7일 안에 답변
- [ ] 보관 기간 → 추천: 처리한 신고 기록 1년, 실시간 수업 이름·응답은 수업 종료 후 30일, 백업은 운영 DB 백업 설정 기간에 맞춤
- [ ] 시행일(공개 날짜)
- [ ] **전문가 검토(LEGAL-09)**: 문구가 정리되면 검토받아요. 개인정보 포털(privacy.go.kr) 처리방침 작성 지원 도구로 셀프 점검 가능. 최종은 변호사·전문가 검토를 권해요.
- [ ] 인프런에 "강의 안에 외부 갤러리 링크를 넣어도 되는지" 문의하고 답을 알려 주세요(POLICY-01).

### 로그인 공개 (AUTH-05g-pub · AUTH-05n-pub) — 학생이 로그인하려면 꼭 필요
- [ ] **구글**: Google Cloud Console → Google 인증 플랫폼(OAuth 동의 화면)
  1. 브랜딩: 앱 이름, 지원 이메일, 홈페이지 = `https://class.yuniq-coding.shop`, 개인정보처리방침 = `…/privacy`, 서비스 약관 = `…/terms`, 승인된 도메인 = `yuniq-coding.shop`
  2. 데이터 액세스(범위): 이메일·프로필·openid만
  3. 대상 → **앱 게시**
- [ ] **네이버**: 네이버 개발자센터 → 내 애플리케이션 → API 설정의 서비스 URL을 운영 주소로 → **검수 요청**(서비스 화면 캡처·사용 목적. 처리방침 주소가 필요할 수 있어요)

### 확인용 학생 계정 (AUTH-검증 · LEGAL-07b)
- [ ] 지금 두 계정이 **모두 관리자**예요. 하나를 일반 학생으로 바꿀지(추천), 새 구글 계정을 만들어 학생용으로 쓸지 정해 주세요. 새 계정은 직접 만들어 주세요.

### 배포 뒤
- [ ] **v1.0 직접 확인 체크리스트** 확인(PC·휴대폰으로 링크 → 로그인 → 올리기 → 보기 한 바퀴, LAUNCH-G3) → "통과"
- [ ] 첫 강의를 공개로 바꾸고 영상 설명란·인프런 자료에 차시 링크·QR 넣기(LAUNCH-G4, 공유 화면의 유튜브용·인프런용 주소)

## v1.1 수업 타이머·음악
- [ ] 배경 음악 3종(잔잔한 · 집중 · 신나는) — 제가 무료 음원 후보를 드리면 고르기
- [ ] 배포 뒤 **v1.1 직접 확인 체크리스트**(실제 수업에서) → "통과"

## v1.2 레퍼런스 모음
- [ ] 레퍼런스 원본 링크 목록(팀플 링크 모음 등) 넘겨주기(REF-04)
- [ ] 배포 뒤 **v1.2 직접 확인 체크리스트** → "통과"

## v1.3 사이드바 목차 · v1.4 슬라이드 + 전자책
- [ ] 각각 배포 뒤 **직접 확인 체크리스트** → "통과"

## v2.0 강사 SaaS — 시작 전에 함께 정해요
- [ ] 강사 역할을 누구에게 줄지, 강사용 화면 범위, 유료 여부

## 강의를 판매하게 되면 (LEGAL-08)
- [ ] 환불 기준(결제 후 며칠·수강 진도 몇 %·자료 내려받기에 따라 전액/일부/불가)과 계산 예시를 정해 주세요. 환불 정책 페이지·상품 페이지·결제 직전 화면에 무조건 넣어요.
