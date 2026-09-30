import type { Deck, LabPost, QuizResponse } from "../types";
import type { SessionState } from "../sync/types";
import type { SlideReaction } from "./reactions";
import type { InkBySlide, Stroke } from "../lecture/inkStore";

export interface LiveState {
  session: SessionState;
  deck: Deck | null;
  responses: QuizResponse[];
  /** 실습 슬라이드에 올라온 결과물 */
  posts: LabPost[];
  revision: number;
  reactions?: SlideReaction[];
  surveyResponses?: import("../lecture/survey").SurveyResponse[];
  wordResponses?: { slideId: string; responderId: string; word: string }[];
  /** 판서 — 지금 보이는 슬라이드(PDF 쪽 번호 기준) 것만 내려준다 */
  ink?: InkBySlide;
  /** 탭 식별자 → 학생이 적은 이름. 강사에게만 내려간다 */
  roster?: import("../lecture/studentStats").Roster;
  /** 강사가 «학생 성향 분석»을 눌러 만든 AI 일지. 강사에게만 내려간다 */
  studentReport?: import("../lecture/studentStats").StudentReport | null;
}

export type LiveCommand =
  | { action: "backup" }
  | { action: "importQuiz"; slideNo: number; pdfPage: number; pdfKey: string; items: {question:string;options:string[];answers:number[]}[] }
  | ({ action: "surveyRespond" } & import("../lecture/survey").SurveyResponse)
  | { action: "replaceMaterial"; deck: Deck; pdfKey: string; name: string }
  | { action: "insertSlide"; anchor: number; side: "before" | "after"; content: NonNullable<import("../types").DeckSlide["content"]>; title: string; expectedDeckUpdatedAt: number }
  | { action: "wordRespond"; slideId: string; responderId: string; word: string }
  | { action: "sample" }
  | { action: "react"; slideNo: number; emoji: string; senderId: string }
  | { action: "patch"; partial: Partial<SessionState> }
  | { action: "deck"; deck: Deck | null }
  | { action: "board"; slideNo: number; boardId: string | null }
  | { action: "class"; classId: string | null }
  | { action: "respond"; itemId: string; responderId: string; choiceIndex: number; choiceIndices?: number[] }
  | { action: "reset"; itemId: string }
  // 판서 (강사만). slideNo는 PDF 쪽 번호
  | { action: "ink"; slideNo: number; stroke: Stroke }
  | { action: "inkUndo"; slideNo: number }
  /** slideNo가 null이면 전체를 지운다 */
  | { action: "inkClear"; slideNo: number | null }
  // 교안 없이 강사가 이 슬라이드에 직접 넣는 것들
  | { action: "addItem"; slideNo: number; question: string; options: string[]; answers: number[] }
  | { action: "removeItem"; slideNo: number; itemId: string }
  /** 문항 고치기 (AI가 만든 문항 검수 등). 선택지가 바뀌면 그 문항 응답은 비운다 */
  | { action: "editItem"; slideNo: number; itemId: string; question: string; options: string[]; answers: number[] }
  /** labNo가 null이면 실습 표시를 뗀다 */
  | { action: "markLab"; slideNo: number; labNo: number | null }
  | { action: "guide"; slideNo: number; markdown: string }
  // 실습 결과물 (학생도 올릴 수 있다)
  | { action: "addPost"; slideNo: number; authorName: string; description: string; imageUrl: string | null; ownerId: string }
  | { action: "removePost"; postId: string; ownerId: string }
  /** 다시 보내면 좋아요가 취소된다 */
  | { action: "likePost"; postId: string; ownerId: string }
  // 학생이 이름을 적으면 탭 식별자와 이어 둔다 — 학생별 집계용
  | { action: "identify"; responderId: string; name: string }
  // AI 결과 저장 (강사만, 버튼을 눌렀을 때 API가 보낸다)
  | { action: "setLabFeedback"; items: { postId: string; feedback: string }[] }
  | { action: "setStudentReport"; report: import("../lecture/studentStats").StudentReport }
  /** 강사가 학생 한 명의 일지를 고쳐 저장. refined면 «AI로 다듬기» 결과 */
  | { action: "updateJournal"; key: string; draft: import("../lecture/studentStats").JournalDraft; refined?: boolean };

