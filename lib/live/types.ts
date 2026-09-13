import type { Deck, QuizResponse } from "../types";
import type { SessionState } from "../sync/types";

export interface LiveState {
  session: SessionState;
  deck: Deck | null;
  responses: QuizResponse[];
  revision: number;
}

export type LiveCommand =
  | { action: "sample" }
  | { action: "patch"; partial: Partial<SessionState> }
  | { action: "deck"; deck: Deck | null }
  | { action: "board"; slideNo: number; boardId: string | null }
  | { action: "class"; classId: string | null }
  | { action: "respond"; itemId: string; responderId: string; choiceIndex: number; choiceIndices?: number[] }
  | { action: "reset"; itemId: string };
