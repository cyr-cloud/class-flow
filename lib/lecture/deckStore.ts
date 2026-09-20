// 슬라이드 구성 + 참여요소 응답 저장소의 계약(interface) + 로컬 구현.
//
// 화면 코드는 DeckStore에만 의존한다. 지금은 localStorage + BroadcastChannel이고,
// 나중에 Supabase(activities / activity_responses) 구현으로 갈아끼운다.
//
// 응답자 식별은 sessionStorage에 둔다 — localStorage로 하면 같은 브라우저의 학생 탭이
// 모두 한 사람으로 세어져서 "몇 명이 눌렀는지"가 나오지 않는다. 탭 하나 = 학생 한 명.

import { Deck, DeckSlide, LabPost, QuizResponse } from "../types";

export interface DeckState {
  deck: Deck | null;
  responses: QuizResponse[];
  /** 실습 슬라이드에 올라온 결과물 */
  posts: LabPost[];
}

export interface DeckStore {
  subscribe(sessionId: string, listener: () => void): () => void;
  snapshot(sessionId: string): DeckState;
  /** 이 탭의 응답자 id (학생 한 명) */
  responderId(): string;

  setDeck(sessionId: string, deck: Deck): void;
  clearDeck(sessionId: string): void;
  /** 실습 슬라이드에 실습 게시판 연결 */
  linkBoard(sessionId: string, slideNo: number, boardId: string | null): void;
  setClassId(sessionId: string, classId: string | null): void;

  /** 한 문항에 한 표. 다시 누르면 선택이 바뀐다 */
  respond(sessionId: string, itemId: string, choiceIndex: number): void | Promise<void>;
  /** 한 문항의 응답 전부 지우기 (다시 풀리고 싶을 때) */
  resetItem(sessionId: string, itemId: string): void;
}

// ── 로컬 구현 ────────────────────────────────────────────────────────

const KEY = (sessionId: string) => `classflow:deck:${sessionId}`;
const CHANNEL = (sessionId: string) => `classflow:deck:${sessionId}`;
const RESPONDER_KEY = "classflow:responderId";

const EMPTY: DeckState = { deck: null, responses: [], posts: [] };

const states = new Map<string, DeckState>();
const listeners = new Map<string, Set<() => void>>();
const channels = new Map<string, BroadcastChannel>();

function parse(raw: string | null): DeckState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<DeckState>;
    return { deck: normalizeDeck(parsed.deck ?? null), responses: parsed.responses ?? [], posts: parsed.posts ?? [] };
  } catch {
    return EMPTY;
  }
}

/**
 * 예전에 저장해 둔 덱을 지금 형식으로 맞춘다.
 * 정답이 하나(answerIndex)에서 여럿(answers)으로 바뀌었는데, 옛 데이터를 그대로 읽으면
 * answers가 없어 화면이 깨진다.
 */
function normalizeDeck(deck: Deck | null): Deck | null {
  if (!deck) return null;
  return {
    ...deck,
    slides: (deck.slides ?? []).map((slide) => ({
      ...slide,
      // 예전 파서는 퀴즈가 아닌 슬라이드에도 문항을 붙였다 — 저장된 덱에서도 걷어낸다
      items: (slide.kind === "quiz" ? slide.items ?? [] : []).map((item) => {
        if (Array.isArray(item.answers)) return item;
        const legacy = (item as { answerIndex?: number | null }).answerIndex;
        return { ...item, answers: typeof legacy === "number" ? [legacy] : [] };
      }),
    })),
  };
}

function emit(sessionId: string) {
  const set = listeners.get(sessionId);
  if (set) for (const l of set) l();
}

function load(sessionId: string) {
  if (typeof window === "undefined") return;
  states.set(sessionId, parse(window.localStorage.getItem(KEY(sessionId))));
}

function persist(sessionId: string, next: DeckState) {
  states.set(sessionId, next);
  try {
    window.localStorage.setItem(KEY(sessionId), JSON.stringify(next));
  } catch {
    /* 용량 초과 등은 무시 — 화면 상태는 이미 갱신됨 */
  }
  channels.get(sessionId)?.postMessage("changed");
  emit(sessionId);
}

const bridged = new Set<string>();

function ensureChannel(sessionId: string) {
  if (bridged.has(sessionId) || typeof window === "undefined") return;
  bridged.add(sessionId);

  const refresh = () => {
    // 다른 탭(학생)이 응답했다 → 다시 읽어온다
    load(sessionId);
    emit(sessionId);
  };

  if (typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel(CHANNEL(sessionId));
    ch.addEventListener("message", refresh);
    channels.set(sessionId, ch);
  }
  // BroadcastChannel만 믿지 않는다. storage 이벤트는 다른 탭의 localStorage 변경에
  // 확실히 따라붙어서, 메시지를 놓쳐도 응답 수가 어긋나지 않는다.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY(sessionId)) refresh();
  });
}

function current(sessionId: string): DeckState {
  return states.get(sessionId) ?? EMPTY;
}

/**
 * 쓰기 직전의 최신 상태.
 * 메모리 값으로 쓰면 여러 탭이 거의 동시에 응답했을 때 서로의 응답을 지운다
 * (실제로 학생 셋이 눌렀는데 하나만 남는 일이 있었다). 저장소에서 다시 읽고 얹는다.
 */
function fresh(sessionId: string): DeckState {
  if (typeof window === "undefined") return current(sessionId);
  return parse(window.localStorage.getItem(KEY(sessionId)));
}

function withDeck(sessionId: string, fn: (deck: Deck) => Deck) {
  const state = fresh(sessionId);
  if (!state.deck) return;
  persist(sessionId, { ...state, deck: { ...fn(state.deck), updatedAt: Date.now() } });
}

export const localDeckStore: DeckStore = {
  subscribe(sessionId, listener) {
    if (!states.has(sessionId)) load(sessionId);
    ensureChannel(sessionId);
    let set = listeners.get(sessionId);
    if (!set) {
      set = new Set();
      listeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  },

  snapshot(sessionId) {
    return current(sessionId);
  },

  responderId() {
    if (typeof window === "undefined") return "";
    let id = window.sessionStorage.getItem(RESPONDER_KEY);
    if (!id) {
      id = `r_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(RESPONDER_KEY, id);
    }
    return id;
  },

  setDeck(sessionId, deck) {
    persist(sessionId, { ...fresh(sessionId), deck: { ...deck, updatedAt: Date.now() } });
  },

  clearDeck(sessionId) {
    persist(sessionId, EMPTY);
  },

  linkBoard(sessionId, slideNo, boardId) {
    withDeck(sessionId, (deck) => ({
      ...deck,
      slides: deck.slides.map((s: DeckSlide) =>
        s.slideNo === slideNo ? { ...s, boardId } : s,
      ),
    }));
  },

  setClassId(sessionId, classId) {
    withDeck(sessionId, (deck) => ({ ...deck, classId }));
  },

  respond(sessionId, itemId, choiceIndex) {
    const state = fresh(sessionId);
    const me = localDeckStore.responderId();
    const rest = state.responses.filter((r) => !(r.itemId === itemId && r.responderId === me));
    persist(sessionId, {
      ...state,
      responses: [...rest, { itemId, responderId: me, choiceIndex, createdAt: Date.now() }],
    });
  },

  resetItem(sessionId, itemId) {
    const state = fresh(sessionId);
    persist(sessionId, {
      ...state,
      responses: state.responses.filter((r) => r.itemId !== itemId),
    });
  },
};
