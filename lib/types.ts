// ClassFlow 공통 데이터 타입
// Supabase 도입 시 목표 스키마와 1:1로 맞춰둔다. 로컬 단계에서는 저장소만 로컬 구현으로 대체.

export type ActivityType = "quiz" | "vote" | "question" | "checkin";

export interface Session {
  id: string;
  title: string;
  currentSlide: number; // 1-based
  activeActivityId: string | null;
  status: "waiting" | "live" | "ended";
  createdAt: number;
}

export interface Slide {
  id: string;
  sessionId: string;
  slideNo: number; // 1-based
  fileUrl: string; // PDF는 세션 단위, slideNo로 페이지 지정
  type: "slide" | "practice";
}

export interface Activity {
  id: string;
  sessionId: string;
  slideNo: number; // 이 슬라이드에 도달하면 등장
  type: ActivityType;
  title: string;
  options: string[]; // quiz/vote 선택지
  isActive: boolean;
}

export interface ActivityResponse {
  id: string;
  activityId: string;
  participantName: string;
  answer: string; // 선택지 텍스트 또는 주관식 답변
  createdAt: number;
}

// ── 결과물 게시판 (수업 > 실습 > 결과물) ──────────────────────────────
// 수업 하나에 실습이 여러 개(≈20), 실습마다 게시판이 하나씩 붙는다.

/** 수업. 게시판들의 컨테이너. id가 곧 학생에게 공유하는 코드. */
export interface ClassRoom {
  id: string;
  title: string;
  createdAt: number;
}

/** 실습 게시판. 수업 안에서 실습 하나에 대응한다. */
export interface Board {
  id: string;
  classId: string;
  no: number; // 실습 번호 (1-based, 목록 정렬 기준)
  title: string;
  description: string;
  createdAt: number;
}

/** 학생이 올린 결과물. (구 GalleryPost) */
export interface Post {
  id: string;
  boardId: string;
  authorName: string; // 빈 문자열이면 화면에서 "익명"으로 표시
  title: string;
  description: string;
  imageKey: string | null; // 이미지 바이트는 IndexedDB(blobStore)에 저장
  projectUrl: string | null;
  ownerId: string; // 올린 브라우저 식별자. 수정/삭제 권한 판단용
  createdAt: number;
}

/** 게시판 보기 방식 */
export type BoardView = "list" | "gallery";

// ── 강의 슬라이드 · 참여요소 ────────────────────────────────────────
// 교안(slide-content.md)의 `## 슬라이드 N: 제목` + `[학생 참여 요소]` 규격을 그대로 담는다.
// 슬라이드 본문이 이미지인 덱이 많아 PDF에서는 제목만 뽑히므로, 문항은 교안 md에서 가져온다.

export type SlideKind = "normal" | "lab" | "quiz";

/** 슬라이드 하나에 걸린 참여요소 한 문항 */
export interface QuizItem {
  /** AI 출제 시 유형 반복을 피하기 위한 분류. 기존 문항은 생략 가능. */
  quizType?: "fact" | "blank" | "matching" | "sequence" | "calculation" | "reading" | "negative" | "ox";
  id: string;
  slideNo: number;
  no: number; // 한 슬라이드 안에서의 문항 번호 (1-based)
  question: string;
  options: string[];
  /**
   * 정답 선택지 index 목록. 빈 배열이면 정답 없는 설문(교안의 "정답: 자유").
   * 교안에 "정답: ① 엑셀, ③ PPT"처럼 복수 정답도 있어 배열로 둔다.
   */
  answers: number[];
  /** 정답 내용은 공개 전 서버에 두고, 문항 종류만 전달한다. */
  hasAnswer?: boolean;
  multiple?: boolean;
}

export interface DeckSlide {
  slideNo: number; // 1-based
  title: string;
  kind: SlideKind;
  /** 실습 번호. 실습 0부터 시작하는 강의가 있어 0도 유효값이다 */
  labNo: number | null;
  /** 연결된 실습 게시판 */
  boardId: string | null;
  items: QuizItem[];
  /** 실습 안내문(마크다운). 학생이 "실습가이드 보러가기"로 읽는다 */
  guide?: string | null;
}

/**
 * 학생이 실습 슬라이드에 올린 인증 결과물.
 *
 * 수업(세션) 상태 안에 같이 담긴다 — 게시판을 따로 두면 저장소가 하나 더 필요한데,
 * 수업은 이미 공유 저장소에 있어서 학생 기기끼리 바로 보인다.
 */
export interface LabPost {
  id: string;
  slideNo: number;
  authorName: string; // 비어 있으면 화면에서 "익명"
  description: string;
  /** 올린 이미지 주소. 없으면 글만 있는 결과물 */
  imageUrl: string | null;
  /** 올린 사람 식별자. 내 글에만 지우기 버튼이 뜬다 */
  ownerId: string;
  /** 좋아요를 누른 사람들. 누른 사람을 담아둬야 다시 눌러 뗄 수 있다 */
  likes?: string[];
  createdAt: number;
}

/** 한 세션의 슬라이드 구성 */
export interface Deck {
  sessionId: string;
  classId: string | null; // 실습 게시판이 속한 수업
  slides: DeckSlide[];
  source: "md" | "pdf";
  updatedAt: number;
}

/** 학생이 참여요소에 낸 응답 (한 문항에 한 명 한 표) */
export interface QuizResponse {
  itemId: string;
  responderId: string; // 탭 단위 식별자
  choiceIndex: number;
  choiceIndices?: number[];
  createdAt: number;
}
