"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function PromoVideo() {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [opened]);

  const close = () => {
    video.current?.pause();
    dialog.current?.close();
  };

  return <>
    <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => {
      setFailed(false);
      setOpened(true);
      dialog.current?.showModal();
    }} className="group mt-7 flex w-full max-w-lg items-center gap-4 rounded-2xl border border-line-strong bg-paper p-3 text-left hover:border-mocha hover:bg-mocha-tint">
      <span className="relative block w-28 shrink-0 overflow-hidden rounded-lg sm:w-36">
        <Image src="/media/classflow-promo-poster.jpg" alt="" width={960} height={540} className="aspect-video w-full object-cover" />
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/90 text-sm text-white">▶</span></span>
      </span>
      <span><span className="block text-sm font-bold text-ink sm:text-base">ClassFlow 1분 소개</span><span className="mt-1 block text-xs text-ink-soft sm:text-sm">영상으로 수업 흐름 살펴보기 · 0:57</span></span>
    </button>
    <dialog ref={dialog} aria-labelledby="promo-title" onCancel={() => video.current?.pause()} onClose={() => {
      video.current?.pause();
      setOpened(false);
      trigger.current?.focus();
    }} onClick={e => { if (e.target === e.currentTarget) close(); }} className="m-auto max-h-[92dvh] w-[min(94vw,960px)] overflow-auto rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <h2 id="promo-title" className="text-base font-bold">ClassFlow 1분 소개</h2>
        <button type="button" aria-label="소개 영상 닫기" onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-gardenia">×</button>
      </div>
      {opened && <video ref={video} src="/media/classflow-promo.mp4" poster="/media/classflow-promo-poster.jpg" controls autoPlay playsInline preload="none" aria-label="ClassFlow 홍보 영상" onError={() => setFailed(true)} className="aspect-video max-h-[70dvh] w-full bg-black object-contain" />}
      {failed && <p role="alert" className="p-4 text-sm">영상을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>}
    </dialog>
  </>;
}
