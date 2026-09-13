"use client";

// 게시판 데이터를 쓰는 React 훅 모음.
// 화면 컴포넌트는 이 훅들만 쓰고, 저장소가 로컬인지 Supabase인지는 몰라도 된다.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Board, ClassRoom, Post } from "../types";
import { BoardStore, localBoardStore } from "./boardStore";
import { getBlob } from "../store/blobStore";

export { useBoardView, useRememberedName } from "./prefs";

// 나중에 여기만 Supabase 구현으로 바꾸면 전체가 전환된다.
export const boardStore: BoardStore = localBoardStore;

const subscribe = (l: () => void) => boardStore.subscribe(l);
const getSnapshot = () => boardStore.snapshot();

export function useBoardData() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 이 브라우저에서 만든 수업 목록 (최신순) */
export function useClasses(): ClassRoom[] {
  const data = useBoardData();
  return useMemo(() => [...data.classes].sort((a, b) => b.createdAt - a.createdAt), [data]);
}

export function useClass(classId: string): ClassRoom | null {
  const data = useBoardData();
  return useMemo(() => data.classes.find((c) => c.id === classId) ?? null, [data, classId]);
}

/** 수업에 속한 실습 게시판 목록 (실습 번호순) + 게시판별 결과물 수 */
export function useBoards(classId: string): { board: Board; postCount: number }[] {
  const data = useBoardData();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data.posts) counts.set(p.boardId, (counts.get(p.boardId) ?? 0) + 1);
    return data.boards
      .filter((b) => b.classId === classId)
      .sort((a, b) => a.no - b.no)
      .map((board) => ({ board, postCount: counts.get(board.id) ?? 0 }));
  }, [data, classId]);
}

export function useBoard(boardId: string): Board | null {
  const data = useBoardData();
  return useMemo(() => data.boards.find((b) => b.id === boardId) ?? null, [data, boardId]);
}

export function usePosts(boardId: string): Post[] {
  const data = useBoardData();
  return useMemo(
    () => data.posts.filter((p) => p.boardId === boardId).sort((a, b) => b.createdAt - a.createdAt),
    [data, boardId],
  );
}

const noopSubscribe = () => () => {};
const emptyOwner = () => "";

/** 이 브라우저 식별자. 내가 올린 글에만 수정/삭제 버튼을 보여주는 데 쓴다. */
export function useOwnerId(): string {
  return useSyncExternalStore(noopSubscribe, () => boardStore.ownerId(), emptyOwner);
}

/** IndexedDB에 있는 이미지 바이트를 화면에 붙일 수 있는 URL로 바꿔준다. */
export function useImageUrl(imageKey: string | null): string | null {
  // 이전 키의 URL이 잠깐 보이지 않도록 키를 함께 들고 있는다.
  const [entry, setEntry] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!imageKey) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    void getBlob("images", imageKey).then((value) => {
      if (cancelled || !value) return;
      const blob = value instanceof Blob ? value : new Blob([value]);
      objectUrl = URL.createObjectURL(blob);
      setEntry({ key: imageKey, url: objectUrl });
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);

  return imageKey && entry?.key === imageKey ? entry.url : null;
}
