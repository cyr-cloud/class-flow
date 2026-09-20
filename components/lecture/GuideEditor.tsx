"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/board/image";
import { liveClient } from "@/lib/live/client";
import GuideMarkdown from "./GuideMarkdown";

export default function GuideEditor({ sessionId, slideNo, source, onDone, onCancel }: {
  sessionId: string; slideNo: number; source: string; onDone: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(source);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useRef({ start: source.length, end: source.length });
  const locked = useRef(false);

  async function insertImage(file: File) {
    if (locked.current) return;
    locked.current = true;
    const { start, end } = selection.current;
    setBusy("이미지 올리는 중…");
    setError("");
    try {
      const blob = await compressImage(file);
      const response = await fetch("/api/image", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "이미지를 올리지 못했어요.");
      const inserted = `\n\n![실습 안내 이미지](${body.url})\n\n`;
      setDraft(current => current.slice(0, start) + inserted + current.slice(end));
      selection.current = { start: start + inserted.length, end: start + inserted.length };
      requestAnimationFrame(() => {
        editor.current?.focus();
        editor.current?.setSelectionRange(start + inserted.length, start + inserted.length);
      });
    } catch (e) { setError(e instanceof Error ? e.message : "이미지를 올리지 못했어요."); }
    finally { locked.current = false; setBusy(""); }
  }

  async function save() {
    if (locked.current) return;
    setError("");
    if (!draft.trim()) { setError("가이드 내용을 입력해 주세요."); return; }
    if (new TextEncoder().encode(draft).length > 200 * 1024) { setError("가이드는 200KB 이하로 저장해 주세요."); return; }
    locked.current = true;
    setBusy("저장 중…");
    try {
      await liveClient(sessionId).send({ action: "guide", slideNo, markdown: draft });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요."); }
    finally { locked.current = false; setBusy(""); }
  }

  return <section className="mx-auto max-w-6xl px-6 py-6">
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h3 className="mr-auto text-lg font-bold">가이드 편집</h3>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (file) void insertImage(file);
      }} />
      <button type="button" disabled={!!busy} onClick={() => fileInput.current?.click()} className="rounded-full border border-line-strong px-4 py-2 disabled:opacity-40">이미지 넣기</button>
      <button type="button" disabled={!!busy} onClick={() => void save()} className="rounded-full bg-mocha px-5 py-2 text-white disabled:opacity-40">{busy || "저장하고 공유"}</button>
      <button type="button" disabled={!!busy} onClick={() => {
        if (draft === source || window.confirm("수정한 내용을 저장하지 않고 닫을까요?")) onCancel();
      }} className="rounded-full border border-line-strong px-4 py-2 disabled:opacity-40">취소</button>
    </div>
    <p className="mb-4 text-sm text-mute">이미지를 넣을 위치에 커서를 놓고 ‘이미지 넣기’를 누르거나 Ctrl+V로 캡처를 붙여넣으세요. 저장 전까지 학생 가이드는 바뀌지 않아요.</p>
    {error && <p role="alert" className="mb-3 text-sm text-rosetan">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <div><label htmlFor="guide-source" className="mb-2 block font-semibold">마크다운 원문</label>
        <textarea id="guide-source" ref={editor} value={draft} readOnly={!!busy} onChange={e => setDraft(e.target.value)}
          onSelect={e => { selection.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
          onPaste={e => {
            const image = Array.from(e.clipboardData.files).find(f => f.type.startsWith("image/"));
            if (image) { e.preventDefault(); void insertImage(image); }
          }} className="min-h-[55vh] w-full resize-y rounded-xl border border-line bg-paper p-4 font-mono text-sm leading-6 outline-none focus:border-mocha" />
      </div>
      <div><h4 className="mb-2 font-semibold">미리보기</h4><div className="max-h-[70vh] min-h-[55vh] overflow-y-auto rounded-xl border border-line bg-paper p-5"><GuideMarkdown source={draft} /></div></div>
    </div>
  </section>;
}
