"use client";

import { useRef } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

export default function StudentJoinQr({ url, sessionId }: { url: string; sessionId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className="flex shrink-0 flex-col items-center gap-2">
    <button type="button" aria-label="학생 입장 QR코드 크게 보기" onClick={() => dialog.current?.showModal()} className="rounded-xl border border-line bg-white p-2">
      <QRCodeCanvas ref={canvas} value={url} size={768} level="M" marginSize={4} style={{ width: 184, height: 184 }} role="img" aria-label="학생 입장 QR코드" />
    </button>
    <p className="text-xs text-ink-soft">휴대폰 카메라로 스캔해 입장하세요</p>
    <div className="flex gap-4 text-xs text-mocha">
      <button type="button" className="underline" onClick={() => dialog.current?.showModal()}>크게 보기</button>
      <button type="button" className="underline" onClick={() => {
        if (!canvas.current) return;
        const a = document.createElement("a"); a.href = canvas.current.toDataURL("image/png"); a.download = `ClassFlow-${sessionId}-학생입장-QR.png`; a.click();
      }}>QR 이미지 저장</button>
    </div>
    <dialog ref={dialog} aria-label="학생 입장 QR코드" className="m-auto w-[min(92vw,600px)] rounded-3xl bg-white p-6 text-center text-ink shadow-xl backdrop:bg-black/60">
      <h2 className="text-2xl font-bold">QR코드를 찍고 수업에 참여하세요</h2>
      <QRCodeSVG value={url} size={512} level="M" marginSize={4} className="mx-auto my-4 h-auto max-h-[60vh] w-full" role="img" aria-label="학생 입장 QR코드" />
      <p className="break-all text-sm text-ink-soft">참여 코드: <strong>{sessionId}</strong></p>
      <form method="dialog"><button className="mt-5 rounded-full bg-ink px-8 py-3 text-white">닫기</button></form>
    </dialog>
  </div>;
}
