// 게시판 저장소의 계약(interface) + 로컬 구현.
//
// 화면 코드는 BoardStore에만 의존한다. 지금은 localStorage(메타) + IndexedDB(이미지) 구현이고,
// 나중에 Supabase(Postgres + Storage) 구현으로 갈아끼워도 화면은 그대로 둔다.
//
// 한계(로컬 구현): 데이터가 브라우저 안에만 있어서 다른 기기끼리는 공유되지 않는다.
// 같은 브라우저의 다른 탭까지만 실시간 반영된다. 여러 기기 공유는 Supabase 전환 시 해결.

import { Board, ClassRoom, Post } from "../types";
import { deleteBlob } from "../store/blobStore";

export interface BoardData {
  classes: ClassRoom[];
  boards: Board[];
  posts: Post[];
}

export interface NewPostInput {
  authorName: string;
  title: string;
  description: string;
  imageKey: string | null;
  projectUrl: string | null;
}

export interface BoardStore {
  /** 변경 구독. 반환값 호출로 해제. */
  subscribe(listener: () => void): () => void;
  /** 현재 스냅샷. 변경 전까지 참조가 유지된다(useSyncExternalStore 안전). */
  snapshot(): BoardData;
  /** 이 브라우저 식별자. 내가 올린 글만 수정/삭제 가능하게 하는 데 쓴다. */
  ownerId(): string;

  createClass(title: string, id?: string): ClassRoom;
  updateClass(id: string, patch: Partial<Pick<ClassRoom, "title">>): void;
  deleteClass(id: string): void;

  createBoard(
    classId: string,
    input?: Partial<Pick<Board, "title" | "description" | "no">>,
  ): Board;
  /** 실습 게시판 여러 개를 한 번에 생성 (수업 하나에 20개씩 만들 때) */
  createBoards(classId: string, count: number): Board[];
  updateBoard(id: string, patch: Partial<Pick<Board, "title" | "description" | "no">>): void;
  deleteBoard(id: string): void;

  createPost(boardId: string, input: NewPostInput): Post;
  updatePost(id: string, patch: Partial<NewPostInput>): void;
  deletePost(id: string): void;
}

// ── 로컬 구현 ────────────────────────────────────────────────────────

const DB_KEY = "classflow:boards";
const OWNER_KEY = "classflow:ownerId";
const CHANNEL = "classflow:boards";

const EMPTY: BoardData = { classes: [], boards: [], posts: [] };

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${rand}`;
}

/** 학생에게 불러주기 좋은 짧은 코드 */
export function shortCode(): string {
  return Math.random().toString(36).slice(2, 8);
}

function parse(raw: string | null): BoardData {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<BoardData>;
    return {
      classes: parsed.classes ?? [],
      boards: parsed.boards ?? [],
      posts: parsed.posts ?? [],
    };
  } catch {
    return EMPTY;
  }
}

let data: BoardData = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (typeof window === "undefined") return;
  data = parse(window.localStorage.getItem(DB_KEY));
  loaded = true;
}

function persist(next: BoardData, broadcast = true) {
  data = next;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(next));
  } catch {
    /* 용량 초과 등은 무시 — 화면 상태는 이미 갱신됨 */
  }
  if (broadcast) channel?.postMessage("changed");
  emit();
}

function ensureChannel() {
  if (channel || typeof window === "undefined") return;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL);
    channel.addEventListener("message", () => {
      // 다른 탭이 바꿨다 → 다시 읽어온다
      data = parse(window.localStorage.getItem(DB_KEY));
      emit();
    });
  }
  // BroadcastChannel이 없는 환경 대비 백업
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY) {
      data = parse(e.newValue);
      emit();
    }
  });
}

function nextBoardNo(classId: string): number {
  const nos = data.boards.filter((b) => b.classId === classId).map((b) => b.no);
  return nos.length ? Math.max(...nos) + 1 : 1;
}

export const localBoardStore: BoardStore = {
  subscribe(listener) {
    if (!loaded) load();
    ensureChannel();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  snapshot() {
    return data;
  },

  ownerId() {
    if (typeof window === "undefined") return "";
    let id = window.localStorage.getItem(OWNER_KEY);
    if (!id) {
      id = uid("me");
      window.localStorage.setItem(OWNER_KEY, id);
    }
    return id;
  },

  createClass(title, id) {
    const cls: ClassRoom = {
      id: id ?? shortCode(),
      title: title.trim() || "새 수업",
      createdAt: Date.now(),
    };
    persist({ ...data, classes: [...data.classes, cls] });
    return cls;
  },

  updateClass(id, patch) {
    persist({
      ...data,
      classes: data.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  },

  deleteClass(id) {
    const boardIds = new Set(data.boards.filter((b) => b.classId === id).map((b) => b.id));
    for (const p of data.posts) {
      if (boardIds.has(p.boardId) && p.imageKey) void deleteBlob("images", p.imageKey);
    }
    persist({
      classes: data.classes.filter((c) => c.id !== id),
      boards: data.boards.filter((b) => b.classId !== id),
      posts: data.posts.filter((p) => !boardIds.has(p.boardId)),
    });
  },

  createBoard(classId, input) {
    // 강의자료에서 만들 때는 실습 번호를 그대로 쓴다 (실습 0부터 시작하는 강의가 있다).
    // 그래야 게시판 목록의 번호와 제목의 "실습 N"이 어긋나지 않는다.
    const no = input?.no ?? nextBoardNo(classId);
    const board: Board = {
      id: uid("b"),
      classId,
      no,
      title: input?.title?.trim() || `실습 ${no}`,
      description: input?.description ?? "",
      createdAt: Date.now(),
    };
    persist({ ...data, boards: [...data.boards, board] });
    return board;
  },

  createBoards(classId, count) {
    const start = nextBoardNo(classId);
    const now = Date.now();
    const created: Board[] = Array.from({ length: count }, (_, i) => ({
      id: uid("b"),
      classId,
      no: start + i,
      title: `실습 ${start + i}`,
      description: "",
      createdAt: now + i,
    }));
    persist({ ...data, boards: [...data.boards, ...created] });
    return created;
  },

  updateBoard(id, patch) {
    persist({
      ...data,
      boards: data.boards.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  },

  deleteBoard(id) {
    for (const p of data.posts) {
      if (p.boardId === id && p.imageKey) void deleteBlob("images", p.imageKey);
    }
    persist({
      ...data,
      boards: data.boards.filter((b) => b.id !== id),
      posts: data.posts.filter((p) => p.boardId !== id),
    });
  },

  createPost(boardId, input) {
    const post: Post = {
      id: uid("p"),
      boardId,
      authorName: input.authorName.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      imageKey: input.imageKey,
      projectUrl: input.projectUrl?.trim() || null,
      ownerId: localBoardStore.ownerId(),
      createdAt: Date.now(),
    };
    persist({ ...data, posts: [...data.posts, post] });
    return post;
  },

  updatePost(id, patch) {
    const prev = data.posts.find((p) => p.id === id);
    // 이미지를 갈아끼웠으면 예전 바이트는 지운다
    if (prev && "imageKey" in patch && prev.imageKey && prev.imageKey !== patch.imageKey) {
      void deleteBlob("images", prev.imageKey);
    }
    persist({
      ...data,
      posts: data.posts.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              projectUrl: patch.projectUrl !== undefined ? patch.projectUrl || null : p.projectUrl,
            }
          : p,
      ),
    });
  },

  deletePost(id) {
    const target = data.posts.find((p) => p.id === id);
    if (target?.imageKey) void deleteBlob("images", target.imageKey);
    persist({ ...data, posts: data.posts.filter((p) => p.id !== id) });
  },
};
