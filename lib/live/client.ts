"use client";
import { initialSessionState } from "../sync/types";
import type { LiveCommand, LiveState } from "./types";

export interface ClientState extends LiveState { status: string; error: string }
export const emptyLive: ClientState = { session: initialSessionState, deck: null, responses: [], posts: [], revision: -1, status: "연결 중…", error: "" };
const clients = new Map<string, ReturnType<typeof createClient>>();
export function responderId() {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("classflow:responderId");
  if (!id) { id = `r_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; sessionStorage.setItem("classflow:responderId", id); }
  return id;
}
function createClient(id: string) {
  let state = emptyLive;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  const url = `/api/live/${encodeURIComponent(id)}`;
  function headers(create = false): Record<string, string> {
    if (!window.location.pathname.startsWith("/teacher/")) return {};
    const key = `classflow:teacher:${id}`;
    let token = localStorage.getItem(key);
    if (!token && create) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      token = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(key, token);
    }
    return token ? { "x-teacher-token": token } : {};
  }
  function update(next: ClientState) { state = next; listeners.forEach(l => l()); }
  function accept(next: LiveState, saved = false) {
    if (next.revision >= state.revision) update({ ...next, status: "실시간 연결됨", error: saved ? "" : state.error });
  }
  /**
   * 다음에 물어볼 때까지 기다리는 시간.
   *
   * 강사가 슬라이드를 넘기는 순간은 빨리 따라가야 하지만, 한 장을 몇 분씩 설명하는
   * 동안에도 0.7초마다 묻는 건 낭비다 — 학생 서른 명이면 세 시간에 오십만 번이 된다.
   * 그래서 바뀐 게 없으면 조금씩 늘리고, 바뀌는 순간 다시 빨라진다.
   * 늘어난 동안에도 넘김이 늦게 보이지는 않는다 — 넘긴 쪽이 응답으로 최신 상태를 받고,
   * 보는 쪽은 최대 MAX_WAIT 안에 따라잡는다.
   *
   * MAX_WAIT을 더 늘리지 않는 이유: 이모지 반응이 5초만 살아 있다.
   * 그보다 느리게 물어보면 반응이 뜨기도 전에 사라져서 «아무도 안 누르네»처럼 보인다.
   */
  const MIN_WAIT = 700;
  const MAX_WAIT = 2000;
  let wait = MIN_WAIT;

  async function poll() {
    try {
      const res = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const next = await res.json() as LiveState;
        // 바뀌었으면 다시 바짝 붙고, 그대로면 한 박자씩 느슨하게
        wait = next.revision !== state.revision ? MIN_WAIT : Math.min(wait + 700, MAX_WAIT);
        accept(next);
      }
      else if (res.status === 404) { wait = MAX_WAIT; update({ ...state, status: "수업 준비 대기", error: "" }); }
      else throw new Error();
    } catch { wait = MAX_WAIT; update({ ...state, status: "연결 끊김 · 다시 연결 중…" }); }
    finally { if (listeners.size) timer = setTimeout(poll, wait); }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && id) { clearTimeout(timer); void poll(); }
      return () => { listeners.delete(listener); if (!listeners.size) clearTimeout(timer); };
    },
    send(command: LiveCommand): Promise<void> {
      const task = queue.then(async () => {
        try {
          const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers(true) },
            body: JSON.stringify(command), signal: AbortSignal.timeout(15000) });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "저장하지 못했어요.");
          accept(body, true);
          // 내가 방금 바꿨으니 남들도 곧 따라온다 — 느슨해져 있었다면 다시 당긴다
          wait = MIN_WAIT;
        } catch (error) {
          const message = error instanceof Error ? error.message : "전송하지 못했어요. 다시 눌러 주세요.";
          update({ ...state, error: message });
          throw error;
        }
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
export function liveClient(id: string) {
  let client = clients.get(id);
  if (!client) { client = createClient(id); clients.set(id, client); }
  return client;
}
export function sendLive(id: string, command: LiveCommand) { void liveClient(id).send(command).catch(() => {}); }
