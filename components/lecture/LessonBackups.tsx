"use client";
import { useEffect, useRef, useState } from "react";
import { liveClient } from "@/lib/live/client";
import type { BackupSummary } from "@/lib/live/backups";

export default function LessonBackups({ sessionId, ready }: { sessionId: string; ready: boolean }) {
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const [entries, setEntries] = useState<BackupSummary[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const save = async () => {
      try {
        await liveClient(sessionId).send({ action: "backup" });
        if (active) { setMessage("자동 백업 확인 완료"); setFailed(false); }
      } catch { if (active) { setMessage("자동 백업 실패 · 연결을 확인해 주세요. 다음 주기에 다시 시도합니다."); setFailed(true); } }
    };
    void save();
    const timer = window.setInterval(() => void save(), 5 * 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") void save(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [sessionId, ready]);
  const request = async (revision?: number) => {
    const response = await fetch(`/api/backups?sessionId=${encodeURIComponent(sessionId)}${revision === undefined ? "" : `&revision=${revision}`}`, {
      headers: { "x-teacher-token": localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "" }, cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "백업을 읽지 못했어요.");
    return body;
  };
  return <>
      <button type="button" aria-haspopup="dialog" className={`rounded-full border px-4 py-2 text-sm ${failed ? "border-rosetan text-rosetan" : "border-line-strong text-ink-soft"}`} onClick={async () => {
        dialog.current?.showModal();
        setEntries(null);
        try { setEntries((await request()).backups); } catch (e) { setMessage((e as Error).message); }
      }}>{failed ? "백업 오류 · 확인" : "백업 기록"}</button>
    <dialog ref={dialog} aria-label="수업 백업 기록" className="m-auto max-h-[85dvh] w-[min(92vw,720px)] overflow-auto rounded-2xl bg-paper p-6 text-sm text-ink-soft shadow-xl backdrop:bg-black/50">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-ink">백업 기록</h2><form method="dialog"><button className="min-h-12 rounded-full border border-line-strong px-6 py-2">닫기</button></form></div>
    <p className="mt-4">5분마다 변경 내용 자동 백업 · 자료 교체 전에도 보관</p>
    <p role="status" className="mt-2 text-xs">{message}</p>
    {entries && <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{entries.length ? entries.map(entry => <div key={entry.revision} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-3">
      <span>{new Date(entry.savedAt).toLocaleString("ko-KR")} · {entry.name} · 응답 {entry.answers}건</span>
      <button className="underline" onClick={async () => {
        try {
          const data = await request(entry.revision);
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          const a = document.createElement("a"); a.href = url; a.download = `ClassFlow-${sessionId}-${entry.revision}-backup.json`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) { setMessage((e as Error).message); }
      }}>백업 다운로드</button>
    </div>) : <p>아직 저장된 백업이 없어요.</p>}</div>}
    </dialog>
  </>;
}
