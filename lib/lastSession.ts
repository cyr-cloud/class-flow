"use client";

// 마지막으로 연 세션 코드 기억.
// 헤더의 "강의 진행 / 학생 화면" 탭이 매번 코드를 다시 묻지 않게 하려고 둔다.
// localStorage는 React 밖의 값이라 useSyncExternalStore로 읽는다 (하이드레이션 안전).

import { useSyncExternalStore } from "react";

const KEY = "classflow:lastSession";

const listeners = new Set<() => void>();
let cached: string | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(KEY) ?? "";
    } catch {
      cached = "";
    }
  }
  return cached;
}

const empty = () => "";

/** 세션 화면에 들어갈 때 호출. 같은 값이면 아무 일도 하지 않는다. */
export function rememberSession(sessionId: string) {
  if (!sessionId || cached === sessionId) return;
  cached = sessionId;
  try {
    window.localStorage.setItem(KEY, sessionId);
  } catch {
    /* 시크릿 모드 등은 무시 */
  }
  for (const l of listeners) l();
}

export function useLastSession(): string {
  return useSyncExternalStore(subscribe, snapshot, empty);
}
