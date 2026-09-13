"use client";
import { initialSessionState } from "../sync/types";
import type { LiveCommand, LiveState } from "./types";

export interface ClientState extends LiveState { status: string; error: string }
export const emptyLive: ClientState = { session: initialSessionState, deck: null, responses: [], revision: -1, status: "연결 중…", error: "" };
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
  async function poll() {
    try {
      const res = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (res.ok) accept(await res.json());
      else if (res.status === 404) update({ ...state, status: "수업 준비 대기", error: "" });
      else throw new Error();
    } catch { update({ ...state, status: "연결 끊김 · 다시 연결 중…" }); }
    finally { if (listeners.size) timer = setTimeout(poll, 700); }
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
