// 판서 저장소 — 펜·형광펜·직선·화살표·사각형·원.
//
// 좌표는 슬라이드 기준 0~1 비율로 담는다. 그래야 창 크기나 전체화면 여부와 상관없이
// 같은 자리에 다시 그려진다.
//
// 두 갈래로 나눠 보낸다:
//  - 그리는 중  : 같은 브라우저의 다른 탭에만 BroadcastChannel로 흘려보낸다 (매 점마다 서버에 보내면 버벅인다)
//  - 손을 뗐을 때: 수업 서버(/api/live)에 한 획씩 올린다 → 다른 기기의 학생은 폴링으로 받는다
//
// 서버 응답이 오기 전까지는 방금 그린 획을 "보내는 중"으로 들고 있다가 겹쳐 그린다.
// 안 그러면 손을 떼는 순간 획이 잠깐 사라졌다가 다시 나타난다.

import { liveClient, sendLive } from "../live/client";

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
  /** 같은 브라우저의 다른 탭에서 지금 그리고 있는 획 (저장 전) */
  live: Stroke | null;
}

const CHANNEL = (sessionId: string) => `classflow:ink:${sessionId}`;
/** 다른 탭이 방금 올린 획을 서버에서 받아올 때까지 들고 있는 시간 (폴링 최대 간격보다 길게) */
const ECHO_MS = 3000;

interface Pending { slideNo: number; stroke: Stroke }
const NO_PENDING: Pending[] = [];

const pendings = new Map<string, Pending[]>();
const lives = new Map<string, Stroke | null>();
const listeners = new Map<string, Set<() => void>>();
const channels = new Map<string, BroadcastChannel>();
const cache = new Map<string, { revision: number; pending: Pending[]; live: Stroke | null; value: InkState }>();

type Message =
  | { kind: "live"; stroke: Stroke }
  | { kind: "commit"; slideNo: number; stroke: Stroke }
  | { kind: "cancel" };

function emit(sessionId: string) {
  const set = listeners.get(sessionId);
  if (set) for (const l of set) l();
}

function setLive(sessionId: string, stroke: Stroke | null) {
  lives.set(sessionId, stroke);
  emit(sessionId);
}

function addPending(sessionId: string, entry: Pending) {
  pendings.set(sessionId, [...(pendings.get(sessionId) ?? NO_PENDING), entry]);
  emit(sessionId);
}

function dropPending(sessionId: string, strokeId: string) {
  const list = pendings.get(sessionId) ?? NO_PENDING;
  if (!list.some(p => p.stroke.id === strokeId)) return;
  pendings.set(sessionId, list.filter(p => p.stroke.id !== strokeId));
  emit(sessionId);
}

function ensureChannel(sessionId: string) {
  if (channels.has(sessionId) || typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(CHANNEL(sessionId));
  ch.addEventListener("message", (e: MessageEvent<Message>) => {
    const msg = e.data;
    if (msg?.kind === "live") setLive(sessionId, msg.stroke);
    else if (msg?.kind === "commit") {
      lives.set(sessionId, null);
      addPending(sessionId, { slideNo: msg.slideNo, stroke: msg.stroke });
      setTimeout(() => dropPending(sessionId, msg.stroke.id), ECHO_MS);
    } else setLive(sessionId, null);
  });
  channels.set(sessionId, ch);
}

function post(sessionId: string, msg: Message) {
  channels.get(sessionId)?.postMessage(msg);
}

export const inkStore = {
  subscribe(sessionId: string, listener: () => void) {
    ensureChannel(sessionId);
    let set = listeners.get(sessionId);
    if (!set) {
      set = new Set();
      listeners.set(sessionId, set);
    }
    set.add(listener);
    const unsubscribeLive = liveClient(sessionId).subscribe(listener);
    return () => {
      set.delete(listener);
      unsubscribeLive();
    };
  },

  /** 서버 판서 + 보내는 중인 획. 바뀐 게 없으면 같은 객체를 돌려준다 */
  snapshot(sessionId: string): InkState {
    const server = liveClient(sessionId).snapshot();
    const pending = pendings.get(sessionId) ?? NO_PENDING;
    const live = lives.get(sessionId) ?? null;
    const hit = cache.get(sessionId);
    if (hit && hit.revision === server.revision && hit.pending === pending && hit.live === live) return hit.value;

    let strokes: InkBySlide = server.ink ?? {};
    if (pending.length) {
      strokes = { ...strokes };
      for (const { slideNo, stroke } of pending) {
        const list = strokes[slideNo] ?? [];
        if (!list.some(s => s.id === stroke.id)) strokes[slideNo] = [...list, stroke];
      }
    }
    const value = { strokes, live };
    cache.set(sessionId, { revision: server.revision, pending, live, value });
    return value;
  },

  /** 그리는 중 — 저장하지 않고 같은 브라우저의 다른 화면에만 흘려보낸다 */
  stream(sessionId: string, stroke: Stroke) {
    post(sessionId, { kind: "live", stroke });
  },

  /** 손을 뗐다 — 서버에 올린다 */
  commit(sessionId: string, slideNo: number, stroke: Stroke) {
    if (stroke.points.length < 2) {
      post(sessionId, { kind: "cancel" });
      return;
    }
    addPending(sessionId, { slideNo, stroke });
    post(sessionId, { kind: "commit", slideNo, stroke });
    void liveClient(sessionId)
      .send({ action: "ink", slideNo, stroke })
      .catch(() => {})
      .finally(() => dropPending(sessionId, stroke.id));
  },

  undo(sessionId: string, slideNo: number) {
    sendLive(sessionId, { action: "inkUndo", slideNo });
  },

  clearSlide(sessionId: string, slideNo: number) {
    sendLive(sessionId, { action: "inkClear", slideNo });
  },

  clearAll(sessionId: string) {
    sendLive(sessionId, { action: "inkClear", slideNo: null });
  },
};

export function newStrokeId(): string {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}
