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

  // 결과물은 수업 안에 담겨 있다 — 실습 슬라이드에서 바로 열린다.
  // 세션은 계속 구독해 둔다: 역할을 바꿔도 같은 수업으로 이어가야 한다.
  useDeckState(sessionId);

  const openTeacher = () => router.push(`/teacher/${sessionId || newCode()}`);
  const openStudent = () => {
    if (sessionId) router.push(`/student/${sessionId}`);
    else router.push("/");
  };

  const roleButton = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mocha ${
      active ? "bg-white text-ink" : "text-white/60 hover:text-white"
    }`;

  return (
    // 이름표 줄. 수업 내내 위에 붙어 있으므로 여기가 이 앱의 얼굴이다
    <header className="sticky top-0 z-40 border-b border-line-strong bg-ink text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3 sm:px-6">
        <Link
          href="/"
          aria-label="ClassFlow 첫 화면"
          className="mr-2 flex shrink-0 items-center gap-2 rounded-full transition-opacity hover:opacity-80 sm:mr-5"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-mocha text-[13px] font-bold text-white">
            C
          </span>
          <span className="text-[17px] font-bold tracking-tight">ClassFlow</span>
        </Link>

        <nav aria-label="수업 메뉴" className="flex min-w-0 items-center gap-1 sm:gap-3">
          <div role="group" aria-label="강사·학생 화면 전환" className="flex shrink-0 items-center rounded-full bg-white/10 p-1">
            <button type="button" onClick={openTeacher} aria-pressed={role === "teacher"} className={roleButton(role === "teacher")}>
              강사
            </button>
            <button type="button" onClick={openStudent} aria-pressed={role === "student"} className={roleButton(role === "student")}>
              학생
            </button>
          </div>
        </nav>

        {sessionId && (
          <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
            <span className="text-xs text-white/50">세션</span>
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white/85">
              {sessionId}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

