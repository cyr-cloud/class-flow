"use client";

// "이 브라우저의 설정" 저장소.
// - 마지막에 쓴 이름 (다음 실습에서 다시 안 치게)
// - 게시판별 보기 방식 (리스트형 / 갤러리형)
//
// localStorage는 React 밖의 값이라 useSyncExternalStore로 읽는다.
// (effect 안에서 setState 하는 방식은 SSR 첫 렌더 후 한 번 더 그리게 되고 린트에도 걸린다.)

import { useCallback, useSyncExternalStore } from "react";
import { BoardView } from "../types";

const NAME_KEY = "classflow:name";
const VIEW_KEY = "classflow:view:";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 시크릿 모드 등에서 실패해도 화면 동작은 유지 */
  }
}

// ── 이름 ──────────────────────────────────────────────────────────────

const nameListeners = new Set<() => void>();
let cachedName: string | null = null;

function subscribeName(listener: () => void) {
  nameListeners.add(listener);
  return () => {
    nameListeners.delete(listener);
  };
}

function nameSnapshot(): string {
  if (cachedName === null) cachedName = readLocal(NAME_KEY) ?? "";
  return cachedName;
}

const emptyName = () => "";

/** 한 번 입력한 이름을 기억해 다음 실습에서 다시 안 치게 한다. */
export function useRememberedName(): [string, (name: string) => void] {
  const name = useSyncExternalStore(subscribeName, nameSnapshot, emptyName);
  const save = useCallback((next: string) => {
    cachedName = next;
    writeLocal(NAME_KEY, next);
    for (const l of nameListeners) l();
  }, []);
  return [name, save];
}

// ── 보기 방식 ─────────────────────────────────────────────────────────

const viewListeners = new Set<() => void>();
const viewCache = new Map<string, BoardView>();

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

function viewSnapshot(boardId: string): BoardView {
  const cached = viewCache.get(boardId);
  if (cached) return cached;
  const saved = readLocal(VIEW_KEY + boardId);
  const value: BoardView = saved === "list" || saved === "gallery" ? saved : "gallery";
  viewCache.set(boardId, value);
  return value;
}

const defaultView = (): BoardView => "gallery";

/** 게시판별로 마지막에 고른 보기 방식을 기억한다. */
export function useBoardView(boardId: string): [BoardView, (view: BoardView) => void] {
  const view = useSyncExternalStore(
    subscribeView,
    () => viewSnapshot(boardId),
    defaultView,
  );
  const setView = useCallback(
    (next: BoardView) => {
      viewCache.set(boardId, next);
      writeLocal(VIEW_KEY + boardId, next);
      for (const l of viewListeners) l();
    },
    [boardId],
  );
  return [view, setView];
}
