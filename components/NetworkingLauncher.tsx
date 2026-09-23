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
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.code !== "KeyN" || event.repeat || pathname?.startsWith("/student/")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      event.preventDefault();
      setPrevious(localStorage.getItem(SAVED) ?? "");
      dialog.current?.showModal();
    };
    window.addEventListener("keydown", open);
    return () => window.removeEventListener("keydown", open);
  }, [pathname]);

  const start = async () => {
    setBusy(true); setMessage("수업을 준비하고 있어요…");
    try {
      const response = await fetch("/events/networking-20260923.json");
      if (!response.ok) throw Error("행사 자료를 불러오지 못했어요.");
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

  return <>
    {pathname === "/" && <button type="button" onClick={()=>{
      setPrevious(localStorage.getItem(SAVED) ?? "");
      dialog.current?.showModal();
    }} className="fixed bottom-5 right-5 z-40 rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-medium text-mocha-deep shadow-md hover:bg-mocha-tint">9/23 네트워킹 수업</button>}
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
