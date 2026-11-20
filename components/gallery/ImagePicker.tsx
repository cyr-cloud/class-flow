'use client';
// 결과물 이미지 고르기 (GAL-01b): 파일 선택 · 끌어다 놓기 · Ctrl+V 붙여넣기 → 브라우저에서 줄이기 → 서버로 올리기.
import { useCallback, useEffect, useRef, useState } from 'react';
import { compressImage } from '@/lib/board/image';
import { MAX_IMAGES, MAX_IMAGE_BYTES, MAX_ORIGINAL_BYTES } from '@/lib/gallery/model';

export interface PickedImage { path: string; url: string }
type Slot = { id: string; status: 'uploading' } | ({ id: string; status: 'done' } & PickedImage);

export default function ImagePicker({ onChange, error }: { onChange: (paths: string[]) => void; error?: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const count = useRef(0); // 올리는 중인 것까지 센 장 수(동시에 여러 장 넣을 때 4장 넘지 않게)

  useEffect(() => {
    onChange(slots.flatMap((s) => (s.status === 'done' ? [s.path] : [])));
  }, [slots, onChange]);

  const addFiles = useCallback(async (files: File[]) => {
    setMessage('');
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) { if (files.length) setMessage('이미지 파일만 올릴 수 있어요.'); return; }
    const room = MAX_IMAGES - count.current;
    if (room <= 0) { setMessage(`이미지는 ${MAX_IMAGES}장까지예요.`); return; }
    if (images.length > room) setMessage(`이미지는 ${MAX_IMAGES}장까지예요. 앞의 ${room}장만 올릴게요.`);
    for (const file of images.slice(0, room)) {
      if (file.type === 'image/gif') { setMessage('GIF는 올릴 수 없어요. 화면 캡처(png)나 사진(jpg)으로 올려주세요.'); continue; }
      if (file.size > MAX_ORIGINAL_BYTES) { setMessage('20MB가 넘는 이미지는 올릴 수 없어요.'); continue; }
      const id = crypto.randomUUID();
      count.current += 1;
      setSlots((s) => [...s, { id, status: 'uploading' }]);
      try {
        const blob = await compressImage(file);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error('줄여도 5MB가 넘어요. 더 작은 이미지로 올려주세요.');
        const body = new FormData();
        body.append('file', blob, 'image');
        const res = await fetch('/api/gallery/images', { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || '이미지를 올리지 못했어요.');
        setSlots((s) => s.map((x) => (x.id === id ? { id, status: 'done', path: data.path, url: data.url } : x)));
      } catch (e) {
        count.current -= 1;
        setSlots((s) => s.filter((x) => x.id !== id));
        setMessage(e instanceof Error ? e.message : '이미지를 올리지 못했어요.');
      }
    }
  }, []);

  // 화면 어디서든 Ctrl+V로 캡처를 붙여 넣는다. 글자 붙여넣기는 그대로 둔다.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;
      event.preventDefault();
      void addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const remove = (slot: Slot) => {
    if (slot.status !== 'done') return;
    count.current -= 1;
    setSlots((s) => s.filter((x) => x.id !== slot.id));
    void fetch('/api/gallery/images', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: slot.path }) }).catch(() => {});
  };

  const full = slots.length >= MAX_IMAGES;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((s, i) => (
          <div key={s.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-cream">
            {s.status === 'done' ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소 */}
                <img src={s.url} alt={`올린 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => remove(s)} aria-label={`이미지 ${i + 1} 빼기`}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-ink/70 text-sm text-white hover:bg-ink">×</button>
              </>
            ) : (
              <p className="grid h-full place-items-center text-xs text-mute">올리는 중…</p>
            )}
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}
            className={`aspect-square rounded-xl border-2 border-dashed px-2 text-center text-xs leading-relaxed text-mute hover:border-mocha hover:text-mocha ${dragging ? 'border-mocha bg-mocha-tint' : 'border-line-strong'}`}
          >
            <span className="block text-2xl">＋</span>
            사진 고르기<br />또는 Ctrl+V
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
        onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      <p className="mt-2 text-xs text-mute">{slots.length}/{MAX_IMAGES}장 · 캡처는 Ctrl+V로 바로 붙여 넣을 수 있어요. 큰 사진은 자동으로 줄여서 올려요.</p>
      {(message || error) && <p role="alert" className="mt-1 text-xs text-mocha-deep">{message || error}</p>}
    </div>
  );
}
