"use client";
import { useCallback, useSyncExternalStore } from "react";
import { emptyLive, liveClient } from "@/lib/live/client";
const serverSnapshot = () => emptyLive;
export default function LiveStatus({ sessionId }: { sessionId: string }) {
  const subscribe = useCallback((l: () => void) => liveClient(sessionId).subscribe(l), [sessionId]);
  const snapshot = useCallback(() => liveClient(sessionId).snapshot(), [sessionId]);
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return <p role="status" className="mb-4 text-sm text-ink-soft">{state.status}{state.error && ` · ${state.error}`}</p>;
}
