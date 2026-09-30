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
  /** labNo가 null이면 실습 표시를 뗀다 */
  | { action: "markLab"; slideNo: number; labNo: number | null }
  | { action: "guide"; slideNo: number; markdown: string }
  // 실습 결과물 (학생도 올릴 수 있다)
  | { action: "addPost"; slideNo: number; authorName: string; description: string; imageUrl: string | null; ownerId: string }
  | { action: "removePost"; postId: string; ownerId: string }
  /** 다시 보내면 좋아요가 취소된다 */
  | { action: "likePost"; postId: string; ownerId: string };
