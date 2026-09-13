"use client";

// 세션 동기화 상태를 쓰는 React 훅.
// 화면 컴포넌트는 이 훅만 쓰면 되고, 내부 구현(로컬/Supabase)은 몰라도 된다.
//
// 상태는 React 밖(localStorage + BroadcastChannel)에 있으므로 useSyncExternalStore로 읽는다.
// 서버 스냅샷을 initialSessionState로 두어야 SSR 결과와 첫 클라이언트 렌더가 어긋나지 않는다.
// (예전엔 useState 초기값에서 localStorage를 읽어 "대기 중" ↔ "13 / 41" 하이드레이션 오류가 났다.)

import { useCallback, useSyncExternalStore } from "react";
import { liveClient, sendLive } from "../live/client";
import { SessionState, SyncProvider, initialSessionState } from "./types";

// 나중에 여기만 Supabase 구현으로 바꾸면 전체가 전환된다.
function createSync(sessionId: string): SyncProvider {
  const client = liveClient(sessionId);
  return {
    get: () => client.snapshot().session,
    subscribe: listener => client.subscribe(() => listener(client.snapshot().session)),
    patch: partial => sendLive(sessionId, { action: "patch", partial }),
    dispose() {},
  };
}

// 세션당 하나만 만들어 재사용한다. 한 페이지가 한 세션을 보므로 사실상 하나.
const providers = new Map<string, SyncProvider>();

function getProvider(sessionId: string): SyncProvider {
  let provider = providers.get(sessionId);
  if (!provider) {
    provider = createSync(sessionId);
    providers.set(sessionId, provider);
  }
  return provider;
}

const serverSnapshot = () => initialSessionState;

export function useSync(sessionId: string) {
  const subscribe = useCallback(
    (onChange: () => void) => getProvider(sessionId).subscribe(() => onChange()),
    [sessionId],
  );
  const getSnapshot = useCallback(() => getProvider(sessionId).get(), [sessionId]);

  const state = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);

  const patch = useCallback(
    (partial: Partial<SessionState>) => getProvider(sessionId).patch(partial),
    [sessionId],
  );

  return { state, patch };
}
