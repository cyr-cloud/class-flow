# ClassFlow

강의용 실시간 슬라이드 플랫폼. 강사가 PPT(→PDF) 슬라이드를 넘기면 학생 화면도 같이 넘어가고,
중간중간 참여요소(퀴즈/투표/질문)가 등장하며, 실습 결과물을 갤러리에 올릴 수 있다.

## 제품 컨셉

- 강사가 슬라이드를 한 장씩 넘김 → 학생 화면 자동 동기화
- 특정 슬라이드에 참여요소가 걸려 있으면, 그 슬라이드에서 학생이 참여(퀴즈/투표/주관식/체크인)
- 강사는 슬라이드 위에 판서 가능 (2차)
- 실습마다 게시판이 하나씩 있고, 학생이 결과물(이미지/링크/설명)을 가입 없이 올린다

### 현재 상태: 게시판 + 슬라이드 진행 + 참여요소까지 동작

**결과물 게시판**을 먼저 완성했고, 그 위에 슬라이드 진행과 참여요소를 얹었다. 수업 하나에 실습이 20개쯤 되므로,
수업(`ClassRoom`) 아래에 실습 게시판(`Board`)을 여러 개 두고, 게시판마다 결과물(`Post`)이 쌓인다.
노션처럼 **리스트형 / 갤러리형**을 토글할 수 있고, 이름은 비우면 익명으로 올라간다.

## 화면(라우트)

| 경로 | 역할 |
|------|------|
| `/` | 랜딩 / 세션 입장 |
| `/teacher/[sessionId]` | 강사용 진행 화면 (슬라이드 넘김, 참여요소 열기, 응답 확인, 판서) |
| `/student/[sessionId]` | 학생용 화면 (슬라이드 자동 따라감, 참여요소 응답) |
| `/board` | 수업 만들기 / 코드로 입장 / 내 수업 목록 |
| `/board/[classId]` | 실습 게시판 목록 (수업 하나에 20개쯤) |
| `/board/[classId]/[boardId]` | 실습 게시판 — 리스트형/갤러리형 전환, 결과물 올리기·보기 |

강사 화면에 PDF와 **교안 마크다운**을 올리면 실습·퀴즈 슬라이드를 알아보고,
실습 슬라이드에는 게시판 바로가기가, 참여요소가 있는 슬라이드에는 문항이 붙는다.

모든 화면 위에 **공통 헤더**(`components/AppHeader.tsx`)가 고정으로 붙는다 — 강의 진행 / 학생 화면 /
결과물 게시판. 마지막으로 연 세션 코드를 기억해서(`lib/lastSession.ts`) 셋 사이를 한 번에 오간다.

**전체화면 발표 모드**(`components/lecture/PresentView.tsx`)와 **판서**(`SlideStage` + `InkCanvas`)를
강사·학생 화면과 발표 모드에서 모두 쓴다.

## 강의 교안과의 연결 (lecture-harness)

강의 교안은 `lecture-harness` 규격을 따른다. 앱은 그 규격을 **그대로 읽는다** — 교안을 앱용으로
다시 만들 필요가 없다.

| 교안 규격 | 앱에서 하는 일 |
|---|---|
| `## 슬라이드 N: 제목` | 슬라이드 번호·제목 |
| 제목의 `[실습 N]` / `실습 N:` | 실습 슬라이드로 인식 → 게시판 연결 |
| 제목의 `퀴즈 N` | 퀴즈 슬라이드로 인식 |
| `**[학생 참여 요소]**`의 `Q.` | 문항 |
| `① … ② …` (참여요소 안 / `보기:` 줄 / 슬라이드 텍스트 줄마다) | 선택지 |
| `정답: ②` · `정답: ① 엑셀, ③ PPT` · `정답: 자유` · `정답: 1번 ③ / 2번 ②` | 정답(복수 가능) / 설문 / 한 슬라이드 여러 문항 |

- 파서: `lib/lecture/parseDeck.ts`. **교안은 CRLF라 파싱 전에 줄바꿈을 통일해야 한다.**
- `정답:` 줄에도 ①②③이 있으므로 선택지를 찾을 때 그 줄은 건너뛴다 (안 그러면 정답이 선택지가 된다).
- 교안 없이 PDF만 올려도 페이지 제목으로 실습·퀴즈는 감지한다 (`lib/lecture/pdfTitles.ts`).
  다만 덱 본문이 이미지인 경우가 많아 **문항·정답은 교안 md에서만** 나온다.
- 교안 md에는 정답과 강사 메모가 들어 있다. **`public/`에 두지 말 것** (학생이 URL로 받아갈 수 있다).

## 기술 스택

- **프론트엔드**: Next.js (App Router) + React + TypeScript
- **슬라이드 렌더링**: PDF.js (PDF를 Canvas에 한 장씩 렌더)
- **판서**: HTML Canvas (2차)
- **실시간 동기화 / DB / 스토리지**: Supabase (Realtime / Postgres / Storage) — **나중에 도입**
- **스타일**: Tailwind 4. 디자인 토큰은 `app/globals.css`의 `@theme inline`에 정의

### 현재 단계 결정: Supabase 없이 시작

1차 개발은 **Supabase 없이** 로컬에서 화면부터 만든다. 동기화 계층은 갈아끼울 수 있게
인터페이스(`SyncProvider`)로 추상화하고, 초기 구현은 다음 중 하나로:

- 같은 브라우저/컴퓨터 내 동기화: `BroadcastChannel` 또는 `localStorage` 이벤트
- 목업 상태(강사 화면에서 상태 조작 → 학생 화면 미리보기)

이후 실시간·다중 접속이 필요해지면 `SyncProvider`의 Supabase 구현으로 교체한다.
슬라이드/참여요소/갤러리 데이터도 처음엔 로컬(메모리/localStorage/정적 파일)로 두고
나중에 Supabase 테이블로 이관한다.

## 데이터 모델 (Supabase 도입 시 목표 스키마)

```
sessions
  id, title, current_slide, active_activity_id, status, created_at

slides
  id, session_id, slide_no, file_url, type

activities            # 참여요소 (슬라이드에 연결)
  id, session_id, slide_no, type(quiz|vote|question|checkin),
  title, options(jsonb), is_active

activity_responses
  id, activity_id, participant_name, answer, created_at

classes               # 수업 (게시판들의 컨테이너)
  id, title, created_at

boards                # 실습 게시판 (수업 하나에 여러 개)
  id, class_id, no, title, description, created_at

posts                 # 학생이 올린 결과물
  id, board_id, author_name, title, description,
  image_url, project_url, owner_id, created_at
```

로컬 단계에서는 위 구조를 그대로 TypeScript 타입으로 두고, 저장소만 로컬 구현으로 대체한다.

## 디자인 (브랜드)

Pantone 2025 **Mocha Mousse(#a47864)** 팔레트. 강의 교안 액센트와 같은 색이라 슬라이드와 앱이
한 톤으로 묶인다. 색은 토큰으로만 쓰고 Tailwind 기본 회색(`gray-*`)은 쓰지 않는다.

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `ink` / `ink-soft` / `mute` | #262626 / #554d47 / #8d837b | 글자 (검정 대신 먹색 — 교안 배경색과 같다) |
| `paper` / `cream` / `gardenia` | #fff / #faf7f3 / #f0e9e0 | 면 |
| `line` / `line-strong` | #e8e0d6 / #d6cabb | 선 (그림자 대신 선으로 구분) |
| `mocha` / `mocha-deep` / `mocha-tint` | #a47864 / #855e4c / #f3ebe6 | 액센트 — 강조는 이 색 하나로 |
| `tendril` | #8ba475 | 정답·완료 |
| `rosetan` `cornflower` `viola` `willow` `cobblestone` | Pantone 2025 | 아바타 색 등 의미가 있을 때만 |

- 라벨은 `.eyebrow` 클래스 (작게·넓은 자간·대문자)
- 본문 서체는 `Noto Sans KR` — 화면 대부분이 한글이다

## 판서 (`lib/lecture/inkStore.ts`)

- 좌표는 **슬라이드 기준 0~1 비율**로 저장한다. 창 크기·전체화면 여부가 달라도 같은 자리에 찍힌다.
- 굵기도 슬라이드 폭 대비 비율. 화면이 커지면 선도 같이 굵어져야 비율이 유지된다.
- **그리는 중에는 BroadcastChannel로만** 흘려보내고(`stream`), **손을 뗄 때 한 번 저장**한다(`commit`).
  매 점마다 localStorage에 쓰면 버벅인다.
- 도형(직선·화살표·사각형·원)은 점 두 개(시작·끝)만 쓴다. 펜·형광펜은 자유곡선.
- 판서 레이어는 펜이 꺼져 있으면 `pointer-events-none` — 슬라이드 아래 UI를 가리지 않는다.

## 아키텍처 원칙

- **저장/동기화는 인터페이스 뒤로.** 화면 코드는 `SyncProvider`(슬라이드 상태)·`BoardStore`(게시판)·
  `DeckStore`(슬라이드 구성/참여요소 응답) 셋에만 의존하고, 로컬↔Supabase 교체가 화면에 영향 없어야 함.
- **브라우저 밖 상태는 `useSyncExternalStore`로 읽는다.** localStorage를 `useState` 초기값이나
  effect 안 setState로 읽으면 하이드레이션이 어긋나고 React Compiler 린트에도 걸린다.
  서버 스냅샷은 항상 "빈 값"을 돌려준다.
- **탭 사이 쓰기는 저장소를 다시 읽고 얹는다.** 메모리 값 기준으로 쓰면 학생 여러 명이 거의 동시에
  응답할 때 서로의 응답을 지운다. 알림도 BroadcastChannel + `storage` 이벤트 둘 다 건다.
- **바이트는 IndexedDB, 메타는 localStorage.** PDF·이미지는 `lib/store/blobStore.ts`,
  나머지 구조화된 데이터는 localStorage. 용량 한계 때문에 나눠 둔 것.
- **슬라이드는 PDF 기준.** 다만 강사는 PPT를 그대로 올릴 수 있고, `app/api/convert`가
  로컬 LibreOffice(`soffice --headless --convert-to pdf`)로 바꿔준다. 브라우저만으로는 못 하는
  일이라 **개발 서버가 도는 로컬에서만** 동작한다 — 배포하면 이 경로는 실패하고 안내만 뜬다.
- **참여요소는 슬라이드 번호에 연결.** 강사가 그 슬라이드에 도달/활성화하면 학생에게 등장.
- 강사=조작 권한, 학생=보기+참여만. 권한을 화면 단에서 명확히 분리.

## 로드맵 요약

`task.md` 참고. 큰 순서:
1. ~~결과물 게시판~~ (수업 > 실습 게시판 > 결과물, 리스트/갤러리 전환, 익명 허용) ✅
2. ~~슬라이드 뷰어 + 강사/학생 화면 + 슬라이드 동기화~~ ✅
3. ~~참여요소(객관식·설문) 응답과 현황 + 실습 슬라이드에서 게시판으로 이동~~ ✅
4. ~~전체화면 발표 모드 + 판서(펜·도형·화살표)~~ ✅
5. **Supabase 전환** ← 지금 막혀 있는 건 이것 하나 (다른 기기 공유)
6. 주관식, 실시간 결과 차트

## 개발 메모

- 게시판 데이터는 **이 브라우저 안에만** 있다(localStorage + IndexedDB). 학생 각자 기기에서
  같은 게시판을 보려면 `BoardStore`의 Supabase 구현이 필요하다. 같은 브라우저의 다른 탭까지는
  BroadcastChannel로 즉시 반영된다.
- 올라온 이미지는 긴 변 1600px / webp로 줄여 저장한다 (`lib/board/image.ts`).
- `npx eslint app components lib` · `npx tsc --noEmit` · `npx next build` 모두 통과 (2026-09-02).
- 응답자 식별은 **sessionStorage**에 둔다. localStorage로 하면 같은 브라우저의 학생 탭이 한 사람으로
  세어져서 "몇 명이 눌렀는지"가 안 나온다. 탭 하나 = 학생 한 명.
- 샘플 강의자료: 원본 PPT는 저장소 루트 `yuko-agit-02-claude-prompting.pptx`,
  `샘플` 버튼이 읽는 PDF는 `public/samples/yuko-agit-02-claude-prompting.pdf` (11MB).
- **교안 md는 `public/`에 두지 않는다** — 정답과 강사 메모가 들어 있어 URL로 새어나간다.
  파일 선택으로만 읽는다.
