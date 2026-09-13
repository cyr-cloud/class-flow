// 판서 저장소 — 펜·형광펜·직선·화살표·사각형·원.
//
// 좌표는 슬라이드 기준 0~1 비율로 담는다. 그래야 창 크기나 전체화면 여부와 상관없이
// 같은 자리에 다시 그려진다.
//
// 두 갈래로 나눠 보낸다:
//  - 그리는 중  : BroadcastChannel로만 흘려보낸다 (localStorage에 매 점마다 쓰면 버벅인다)
//  - 손을 뗐을 때: 저장 + 전파
//
// 나중에 Supabase Realtime 구현으로 교체할 자리.

export type InkTool = "pen" | "highlighter" | "line" | "arrow" | "rect" | "ellipse";

/** 도형(직선·화살표·사각형·원)은 시작점과 끝점 두 개만 쓴다 */
export const SHAPE_TOOLS: InkTool[] = ["line", "arrow", "rect", "ellipse"];

export interface Stroke {
  id: string;
  color: string;
  /** 슬라이드 폭 대비 굵기 비율 */
  width: number;
  tool: InkTool;
  /** [x, y] 0~1 비율 좌표 */
  points: [number, number][];
}

export type InkBySlide = Record<number, Stroke[]>;

export interface InkState {
  strokes: InkBySlide;
  /** 다른 사람이 지금 그리고 있는 획 (저장 전) */
  live: Stroke | null;
}

const KEY = (sessionId: string) => `classflow:ink:${sessionId}`;
const CHANNEL = (sessionId: string) => `classflow:ink:${sessionId}`;

const EMPTY: InkState = { strokes: {}, live: null };

const states = new Map<string, InkState>();
const listeners = new Map<string, Set<() => void>>();
const channels = new Map<string, BroadcastChannel>();
const bridged = new Set<string>();

type Message =
  | { kind: "live"; stroke: Stroke }
  | { kind: "commit" }
  | { kind: "changed" };

function parse(raw: string | null): InkBySlide {
  if (!raw) return {};
  try {
    return (JSON.parse(raw) as InkBySlide) ?? {};
  } catch {
    return {};
  }
}

function emit(sessionId: string) {
  const set = listeners.get(sessionId);
  if (set) for (const l of set) l();
}

function current(sessionId: string): InkState {
  return states.get(sessionId) ?? EMPTY;
}

function setState(sessionId: string, next: InkState) {
  states.set(sessionId, next);
  emit(sessionId);
}

/** 저장소에서 다시 읽는다 (다른 탭 쓰기와 겹치지 않게) */
function freshStrokes(sessionId: string): InkBySlide {
  if (typeof window === "undefined") return current(sessionId).strokes;
  return parse(window.localStorage.getItem(KEY(sessionId)));
}

function persist(sessionId: string, strokes: InkBySlide) {
  try {
    window.localStorage.setItem(KEY(sessionId), JSON.stringify(strokes));
  } catch {
    /* 용량 초과는 무시 */
  }
  setState(sessionId, { strokes, live: null });
  channels.get(sessionId)?.postMessage({ kind: "commit" } satisfies Message);
}

function load(sessionId: string) {
  if (typeof window === "undefined") return;
  setState(sessionId, { strokes: freshStrokes(sessionId), live: current(sessionId).live });
}

function ensureBridge(sessionId: string) {
  if (bridged.has(sessionId) || typeof window === "undefined") return;
  bridged.add(sessionId);

  if (typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel(CHANNEL(sessionId));
    ch.addEventListener("message", (e: MessageEvent<Message>) => {
      const msg = e.data;
      if (msg?.kind === "live") {
        setState(sessionId, { ...current(sessionId), live: msg.stroke });
      } else {
        setState(sessionId, { strokes: freshStrokes(sessionId), live: null });
      }
    });
    channels.set(sessionId, ch);
  }
  // BroadcastChannel을 놓쳐도 저장된 획은 따라오게
  window.addEventListener("storage", (e) => {
    if (e.key === KEY(sessionId)) load(sessionId);
  });
}

export const inkStore = {
  subscribe(sessionId: string, listener: () => void) {
    if (!states.has(sessionId)) load(sessionId);
    ensureBridge(sessionId);
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

  snapshot(sessionId: string): InkState {
    return current(sessionId);
  },

  /** 그리는 중 — 저장하지 않고 다른 화면에만 흘려보낸다 */
  stream(sessionId: string, stroke: Stroke) {
    setState(sessionId, { ...current(sessionId), live: stroke });
    channels.get(sessionId)?.postMessage({ kind: "live", stroke } satisfies Message);
  },

  /** 손을 뗐다 — 저장 + 전파 */
  commit(sessionId: string, slideNo: number, stroke: Stroke) {
    if (stroke.points.length < 2) {
      setState(sessionId, { ...current(sessionId), live: null });
      return;
    }
    const strokes = freshStrokes(sessionId);
    persist(sessionId, { ...strokes, [slideNo]: [...(strokes[slideNo] ?? []), stroke] });
  },

  undo(sessionId: string, slideNo: number) {
    const strokes = freshStrokes(sessionId);
    const list = strokes[slideNo] ?? [];
    if (list.length === 0) return;
    persist(sessionId, { ...strokes, [slideNo]: list.slice(0, -1) });
  },

  clearSlide(sessionId: string, slideNo: number) {
    const strokes = freshStrokes(sessionId);
    if (!strokes[slideNo]?.length) return;
    const next = { ...strokes };
    delete next[slideNo];
    persist(sessionId, next);
  },

  clearAll(sessionId: string) {
    persist(sessionId, {});
  },
};

export function newStrokeId(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}
