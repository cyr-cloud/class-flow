"use client";
import { useEffect, useState } from "react";
import { liveClient } from "@/lib/live/client";
import type { BackupSummary } from "@/lib/live/backups";

export default function LessonBackups({ sessionId, ready }: { sessionId: string; ready: boolean }) {
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<BackupSummary[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const save = async () => {
      try {
        await liveClient(sessionId).send({ action: "backup" });
        if (active) setMessage("자동 백업 확인 완료");
      } catch { if (active) setMessage("자동 백업 실패 · 연결을 확인해 주세요. 다음 주기에 다시 시도합니다."); }
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
  return <div className="mt-4 rounded-xl border border-line p-4 text-sm text-ink-soft">
    <div className="flex flex-wrap items-center justify-between gap-3"><span>5분마다 변경 내용 자동 백업 · 자료 교체 전에도 보관</span>
      <button className="underline" onClick={async () => {
        if (entries) { setEntries(null); return; }
        try { setEntries((await request()).backups); } catch (e) { setMessage((e as Error).message); }
      }}>{entries ? "백업 목록 닫기" : "백업 기록 보기"}</button></div>
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
  </div>;
}
