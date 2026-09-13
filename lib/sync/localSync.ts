// SyncProvider의 로컬 구현.
// - localStorage: 상태 영속(새로고침/늦게 들어온 학생 탭도 최신 상태 복원)
// - BroadcastChannel: 같은 브라우저의 다른 탭에 즉시 전파
//
// 나중에 Supabase Realtime 구현으로 교체 예정. 화면 코드는 SyncProvider만 보므로 영향 없음.

import { SessionState, SyncProvider, Unsubscribe, initialSessionState } from "./types";

const KEY_PREFIX = "classflow:session:";

function storageKey(sessionId: string) {
  return KEY_PREFIX + sessionId;
}

function readStorage(sessionId: string): SessionState {
  if (typeof window === "undefined") return { ...initialSessionState };
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return { ...initialSessionState };
    return { ...initialSessionState, ...(JSON.parse(raw) as Partial<SessionState>) };
  } catch {
    return { ...initialSessionState };
  }
}

export function createLocalSync(sessionId: string): SyncProvider {
  let state = readStorage(sessionId);
  const listeners = new Set<(s: SessionState) => void>();

  // BroadcastChannel은 일부 환경에서 없을 수 있으니 방어적으로.
  const channel: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("classflow:" + sessionId)
      : null;

  function emit() {
    for (const l of listeners) l(state);
  }

  function applyIncoming(next: SessionState) {
    // 더 최신 것만 반영
    if (next.updatedAt >= state.updatedAt) {
      state = next;
      emit();
    }
  }

  channel?.addEventListener("message", (e: MessageEvent) => {
    applyIncoming(e.data as SessionState);
  });

  // 같은 origin 다른 탭에서 localStorage가 바뀌면 storage 이벤트 발생 (BroadcastChannel 백업)
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey(sessionId) && e.newValue) {
      try {
        applyIncoming({ ...initialSessionState, ...(JSON.parse(e.newValue) as Partial<SessionState>) });
      } catch {
        /* ignore */
      }
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return {
    get() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state); // 즉시 현재값 전달
      const unsub: Unsubscribe = () => listeners.delete(listener);
      return unsub;
    },
    patch(partial) {
      state = { ...state, ...partial, updatedAt: Math.max(Date.now(), state.updatedAt + 1) };
      try {
        window.localStorage.setItem(storageKey(sessionId), JSON.stringify(state));
      } catch {
        /* storage full 등 무시 */
      }
      channel?.postMessage(state);
      emit();
    },
    dispose() {
      listeners.clear();
      channel?.close();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    },
  };
}
