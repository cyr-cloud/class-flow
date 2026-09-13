"use client";

// 슬라이드 구성 · 참여요소 응답을 쓰는 React 훅.
// 화면 컴포넌트는 이 훅들만 쓰고, 저장소가 로컬인지 Supabase인지는 몰라도 된다.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DeckSlide, QuizItem, QuizResponse } from "../types";
import { DeckState, DeckStore } from "./deckStore";
import { remoteDeckStore } from "./remoteDeckStore";

// 나중에 여기만 Supabase 구현으로 바꾸면 전체가 전환된다.
export const deckStore: DeckStore = remoteDeckStore;

const EMPTY: DeckState = { deck: null, responses: [] };
const emptySnapshot = () => EMPTY;

export function useDeckState(sessionId: string): DeckState {
  const subscribe = useCallback(
    (l: () => void) => deckStore.subscribe(sessionId, l),
    [sessionId],
  );
  const snapshot = useCallback(() => deckStore.snapshot(sessionId), [sessionId]);
  return useSyncExternalStore(subscribe, snapshot, emptySnapshot);
}

/** 현재 슬라이드 번호에 해당하는 구성 */
export function useCurrentSlide(sessionId: string, slideNo: number): DeckSlide | null {
  const { deck } = useDeckState(sessionId);
  return useMemo(
    () => deck?.slides.find((s) => s.slideNo === slideNo) ?? null,
    [deck, slideNo],
  );
}

const noopSubscribe = () => () => {};
const emptyResponder = () => "";

/** 이 탭의 응답자 id (탭 하나 = 학생 한 명) */
export function useResponderId(): string {
  return useSyncExternalStore(noopSubscribe, () => deckStore.responderId(), emptyResponder);
}

export interface Tally {
  /** 선택지별 응답 수 */
  counts: number[];
  total: number;
  /** 내가 고른 선택지 (안 골랐으면 null) */
  mine: number | null;
  mineChoices: number[];
}

export function tallyOf(
  item: QuizItem,
  responses: QuizResponse[],
  responderId: string,
): Tally {
  const counts = new Array<number>(item.options.length).fill(0);
  let total = 0;
  let mine: number | null = null;
  let mineChoices: number[] = [];
  for (const r of responses) {
    if (r.itemId !== item.id) continue;
    for (const choice of r.choiceIndices ?? [r.choiceIndex]) {
      if (choice >= 0 && choice < counts.length) counts[choice] += 1;
    }
    total += 1;
    if (r.responderId === responderId) { mine = r.choiceIndex; mineChoices = r.choiceIndices ?? [r.choiceIndex]; }
  }
  return { counts, total, mine, mineChoices };
}

/** 덱 안의 실습 슬라이드 목록 (실습 번호순) */
export function useLabSlides(sessionId: string): DeckSlide[] {
  const { deck } = useDeckState(sessionId);
  return useMemo(
    () =>
      (deck?.slides ?? [])
        .filter((s) => s.kind === "lab")
        .sort((a, b) => (a.labNo ?? 0) - (b.labNo ?? 0)),
    [deck],
  );
}
