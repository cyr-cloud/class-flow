"use client";

// 앱 공통 상단 바. 모든 화면에 고정으로 붙는다.
// 수업 중에 강사 화면 ↔ 학생 화면 ↔ 게시판을 자주 오가므로, 그 셋을 항상 한 번에 누를 수 있게 둔다.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { rememberSession, useLastSession } from "@/lib/lastSession";
import { useDeckState } from "@/lib/lecture/useDeck";

function newCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function AppHeader() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const lastSession = useLastSession();

  // 지금 보고 있는 세션 (URL에서). 없으면 마지막으로 열었던 세션을 쓴다.
  const match = pathname.match(/^\/(teacher|student)\/([^/]+)/);
  const role = match?.[1] as "teacher" | "student" | undefined;
  const sessionId = match?.[2] ?? lastSession;

  useEffect(() => {
    if (match?.[2]) rememberSession(match[2]);
  }, [match]);

  // 세션에 연결된 수업이 있으면 게시판 탭은 그 수업으로 보낸다.
  // 학생이 코드로 들어왔을 때 다른 수업이 아니라 이 수업 게시판만 보이게 하는 것.
  const { deck } = useDeckState(sessionId);
  const boardHref = deck?.classId ? `/board/${deck.classId}` : "/board";

  const onBoard = pathname.startsWith("/board");

  const openTeacher = () => router.push(`/teacher/${sessionId || newCode()}`);
  const openStudent = () => {
    if (sessionId) router.push(`/student/${sessionId}`);
    else router.push("/");
  };

  const tab = (active: boolean) =>
    `relative px-3 py-2 text-sm transition-colors ${
      active ? "text-ink" : "text-mute hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-6">
        <Link href="/" className="mr-4 flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-mocha" />
          <span className="font-bold tracking-tight text-ink">ClassFlow</span>
        </Link>

        <nav className="flex min-w-0 items-center">
          <button onClick={openTeacher} className={tab(role === "teacher")}>
            강의 진행
            {role === "teacher" && <Underline />}
          </button>
          <button onClick={openStudent} className={tab(role === "student")}>
            학생 화면
            {role === "student" && <Underline />}
          </button>
          <Link href={boardHref} className={tab(onBoard)}>
            결과물 게시판
            {onBoard && <Underline />}
          </Link>
        </nav>

        {sessionId && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-mute sm:inline">세션</span>
            <span className="rounded-full bg-gardenia px-3 py-1 font-mono text-xs text-ink-soft">
              {sessionId}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

function Underline() {
  return <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-mocha" />;
}
