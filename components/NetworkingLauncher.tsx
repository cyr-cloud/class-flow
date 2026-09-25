"use client";

import {useEffect, useRef, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import type {DeckSlide} from "@/lib/types";

const SAVED = "classflow:networking-20260923";

/** Temporary event launcher; remove its layout import after the event.
 * Always creates a new teacher-owned lesson. Continuing never resets responses.
 */
export default function NetworkingLauncher() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previous, setPrevious] = useState("");
  const [hasSavedLesson, setHasSavedLesson] = useState(false);
  useEffect(() => {
    // The launcher is a browser-local shortcut, not an authorization boundary.
    // Keep it available during network failures; the API still verifies ownership.
    const refresh = () => {
      const id = localStorage.getItem(SAVED);
      setHasSavedLesson(!!id && !!localStorage.getItem(`classflow:teacher:${id}`));
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  },[pathname]);
  useEffect(() => {
    // Recover a missing shortcut only after the server verifies an existing key.
    const id = pathname?.match(/^\/teacher\/(network-[a-zA-Z0-9_-]+)$/)?.[1];
    const token = id ? localStorage.getItem(`classflow:teacher:${id}`) : null;
    if (!id || !token) return;
    let cancelled = false;
    void fetch(`/api/networking?sessionId=${encodeURIComponent(id)}`, {
      headers: { "x-teacher-token": token }, cache: "no-store",
    }).then(response => {
      if (!cancelled && response.ok) {
        localStorage.setItem(SAVED, id);
        setHasSavedLesson(true);
      }
    }).catch(() => { /* The saved shortcut remains available while offline. */ });
    return () => { cancelled = true; };
  }, [pathname]);
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if (!hasSavedLesson || !event.altKey || !event.shiftKey || event.code !== "KeyN" || event.repeat || pathname?.startsWith("/student/")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      event.preventDefault();
      setPrevious(localStorage.getItem(SAVED) ?? "");
      dialog.current?.showModal();
    };
    window.addEventListener("keydown", open);
    return () => window.removeEventListener("keydown", open);
  }, [pathname,hasSavedLesson]);

  const start = async () => {
    setBusy(true); setMessage("수업을 준비하고 있어요…");
    try {
      const owner=localStorage.getItem(SAVED)??"";
      const response = await fetch(`/api/networking?sessionId=${encodeURIComponent(owner)}`,{headers:{"x-teacher-token":localStorage.getItem(`classflow:teacher:${owner}`)??""},cache:"no-store"});
      if (!response.ok) throw Error(response.status === 403
        ? "이 브라우저의 강사 권한을 확인하지 못했어요. 수업을 만들었던 브라우저에서 열어 주세요."
        : "서버에 연결하지 못했어요. 잠시 후 다시 눌러 주세요. 기존 수업은 ‘이어 열기’로 확인할 수 있어요.");
      const preset = await response.json() as {pdfKey:string; name:string; slides:DeckSlide[]};
      if (preset.slides.length !== 38 || !preset.pdfKey.startsWith("https://")) throw Error("행사 자료를 확인해 주세요.");
      const id = `network-${crypto.randomUUID().slice(0,8)}`;
      const token = crypto.randomUUID();
      localStorage.setItem(`classflow:teacher:${id}`, token);
      const saved = await fetch(`/api/live/${id}`, {method:"POST", headers:{"Content-Type":"application/json", "x-teacher-token":token}, body:JSON.stringify({action:"replaceMaterial",name:preset.name,pdfKey:preset.pdfKey,deck:{sessionId:id,classId:null,slides:preset.slides,source:"pdf",updatedAt:Date.now()}})});
      const body = await saved.json();
      if(!saved.ok) throw Error(body.error ?? "수업을 저장하지 못했어요.");
      localStorage.setItem(SAVED,id);
      dialog.current?.close();
      router.push(`/teacher/${id}`);
    } catch(error) {setMessage(error instanceof Error ? error.message : "수업을 열지 못했어요.");}
    finally {setBusy(false);}
  };

  if(!hasSavedLesson || pathname?.startsWith("/student/")) return null;
  return <>
    {pathname === "/" && <button type="button" onClick={()=>{
      setPrevious(localStorage.getItem(SAVED) ?? "");
      dialog.current?.showModal();
    }} aria-label="내 수업 열기" title="내 수업" className="fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-lg text-mocha shadow-sm hover:bg-mocha-tint">✦</button>}
    <dialog ref={dialog} aria-labelledby="networking-title" className="m-auto w-[min(92vw,520px)] rounded-3xl border border-line bg-white p-7 text-ink shadow-xl backdrop:bg-black/50">
    <h2 id="networking-title" className="text-xl font-bold">9/23 강사×운영자 네트워킹</h2>
    <p className="my-4 leading-relaxed">준비된 PPT 28장과 경험 공유 질문 10개를 불러옵니다. 워드클라우드 3개 · 서술형 카드 7개</p>
    <p className="mb-5 text-sm text-ink-soft">새 수업은 답변 없이 시작합니다. 이미 진행한 수업과 답변은 그대로 남습니다.</p>
    <div className="flex flex-col gap-3">
      {previous && <button disabled={busy} className="rounded-xl bg-mocha px-4 py-3 text-white" onClick={()=>{dialog.current?.close();router.push(`/teacher/${previous}`);}}>진행하던 수업 이어 열기</button>}
      <button disabled={busy} className="rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50" onClick={()=>void start()}>{busy?"준비 중…":"새 네트워킹 수업 열기"}</button>
      <button onClick={()=>dialog.current?.close()} className="rounded-xl border border-line px-4 py-3">닫기</button>
    </div>
    <p role="status" className="mt-4 text-sm text-mocha">{message}</p>
  </dialog></>;
}
