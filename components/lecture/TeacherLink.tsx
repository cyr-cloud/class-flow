"use client";

// 강사용 링크 — 수업을 미리 만들어 두고 다른 기기(강의장 PC 등)에서 강사로 열 때 쓴다.
//
// 강사 권한은 수업을 연 브라우저의 localStorage에만 있어서, 기기를 바꾸면 슬라이드를 넘길 수 없다.
// 이 링크는 권한 키를 주소의 # 뒤에 담는다. # 뒤는 서버로 전송되지 않아 접속 기록에 남지 않고,
// 열자마자 주소창에서 지운다. 화면을 프로젝터로 띄우므로 키는 화면에 그리지 않고 복사만 한다.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { emptyLive, liveClient } from "@/lib/live/client";

const KEY = /^#key=([a-f0-9]{20,100})$/;
const storageKey = (sessionId: string) => `classflow:teacher:${sessionId}`;
const emptySnapshot = () => emptyLive;

export default function TeacherLink({ sessionId }: { sessionId: string }) {
  const client = liveClient(sessionId);
  const live = useSyncExternalStore(client.subscribe, client.snapshot, emptySnapshot);
  // 명단(roster)은 강사에게만 내려온다 — 이 브라우저가 강사인지 그걸로 안다
  const isTeacher = live.roster !== undefined;
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "error">("idle");

  // 강사용 링크로 들어왔으면 키를 확인한 뒤 이 브라우저에 저장한다
  useEffect(() => {
    const OPENED = `classflow:teacher-link-opened:${sessionId}`;
    const match = window.location.hash.match(KEY);
    if (!match) {
      // 방금 강사용 링크로 열고 새로고침된 직후
      let opened = false;
      try { opened = window.sessionStorage.getItem(OPENED) === "1"; window.sessionStorage.removeItem(OPENED); } catch { /* 저장소를 못 써도 수업은 열린다 */ }
      if (opened) queueMicrotask(() => setMessage({ kind: "ok", text: "강사용 링크로 열었어요. 이제 이 기기에서도 수업을 진행할 수 있어요." }));
      return;
    }
    // 화면 공유나 방문 기록에 키가 남지 않게 주소에서 먼저 지운다
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const token = match[1];
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(sessionId)}`, { headers: { "x-teacher-token": token }, cache: "no-store" });
        const body = res.ok ? await res.json() : null;
        if (cancelled) return;
        // 틀린 키로 이 기기의 기존 권한을 덮어쓰지 않는다
        if (!body || body.roster === undefined) {
          setMessage({ kind: "error", text: "강사용 링크가 이 수업과 맞지 않아요. 수업을 연 기기에서 링크를 다시 복사해 주세요." });
          return;
        }
        window.localStorage.setItem(storageKey(sessionId), token);
        // 권한 없이 먼저 나간 요청(자동 백업 등)의 오류가 화면에 남지 않게, 강사 권한으로 처음부터 다시 연다
        try { window.sessionStorage.setItem(OPENED, "1"); } catch { /* 안내만 생략된다 */ }
        window.location.reload();
      } catch {
        if (!cancelled) setMessage({ kind: "error", text: "강사용 링크를 확인하지 못했어요. 인터넷 연결을 확인하고 링크를 다시 열어 주세요." });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const copy = useCallback(async () => {
    try {
      const token = window.localStorage.getItem(storageKey(sessionId));
      if (!token || !navigator.clipboard) throw new Error();
      await navigator.clipboard.writeText(`${window.location.origin}/teacher/${sessionId}#key=${token}`);
      setCopied("copied");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied("idle"), 2500);
  }, [sessionId]);

  return (
    <>
      {message && (
        // 이 칸은 화면 맨 아래라, 결과는 스크롤과 상관없이 보이게 띄운다
        <div role={message.kind === "error" ? "alert" : "status"}
          className={`fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-medium shadow-xl ${message.kind === "error" ? "border-rosetan bg-paper text-rosetan" : "border-mocha bg-mocha-tint text-mocha-deep"}`}>
          <span className="min-w-0 flex-1">{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="shrink-0 rounded-full border border-current px-3 py-1 text-xs">확인</button>
        </div>
      )}
      {isTeacher && (
        <details className="mt-4 rounded-2xl border border-line bg-paper p-5">
          <summary className="cursor-pointer text-sm font-medium">다른 기기에서 강사로 열기 · 강사용 링크</summary>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="min-w-0 flex-1 basis-72 text-sm leading-6 text-ink-soft">
              수업을 미리 만들어 두고 강의장 PC 같은 다른 기기에서 진행할 때 쓰세요.
              복사한 링크를 그 기기에서 열면 강사 화면으로 들어갑니다.
            </p>
            <button
              type="button"
              onClick={() => void copy()}
              aria-live="polite"
              className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-mocha-deep"
            >
              {copied === "copied" ? "복사됐어요!" : copied === "error" ? "복사 실패 · 재시도" : "강사용 링크 복사"}
            </button>
          </div>
          <p className="mt-3 rounded-xl bg-gardenia/60 px-4 py-3 text-xs leading-5 text-ink-soft">
            이 링크를 가진 사람은 누구나 슬라이드를 넘기고 수업 자료를 바꿀 수 있어요. 학생에게는
            위의 <span className="font-semibold text-ink">학생 입장 링크</span>만 보내고, 강사용 링크는 본인 메모나 메일에만 보관하세요.
            화면에 띄워도 보이지 않도록 링크 내용은 표시하지 않습니다.
          </p>
        </details>
      )}
    </>
  );
}
