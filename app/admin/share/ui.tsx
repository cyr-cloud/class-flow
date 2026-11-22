'use client';
// 공유 화면 부품 (SHARE-01·02): QR 미리보기 + PNG 내려받기, 주소 복사, 짧은 코드 한 번에 만들기.
import { QRCodeCanvas } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { fillShortCodes } from './actions';

export function ShareQr({ url, fileName, label }: { url: string; fileName: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const download = () => {
    if (!canvas.current) return;
    const a = document.createElement('a');
    a.href = canvas.current.toDataURL('image/png');
    a.download = fileName;
    a.click();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 권한이 없으면 주소를 직접 고른다 */ }
  };
  return (
    <div className="flex items-start gap-4">
      <div className="shrink-0 rounded-lg border border-line bg-white p-1">
        {/* 내려받는 PNG는 1024px로 크게, 화면에는 작게 */}
        <QRCodeCanvas ref={canvas} value={url} size={1024} level="M" marginSize={4} style={{ width: 96, height: 96 }} role="img" aria-label={`${label} QR코드`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-all font-mono text-xs text-ink">{url}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={download} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-mocha-deep">QR PNG 내려받기</button>
          <button type="button" onClick={() => void copy()} className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-mocha">
            {copied ? '복사했어요' : '주소 복사'}
          </button>
          <a href={url} target="_blank" rel="noopener" className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-mocha">열어 보기 ↗</a>
        </div>
      </div>
    </div>
  );
}

export function FillCodes({ courseId, suggestion }: { courseId: string; suggestion: string }) {
  const router = useRouter();
  const [prefix, setPrefix] = useState(suggestion);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(e) => {
      e.preventDefault();
      startTransition(async () => {
        const r = await fillShortCodes(courseId, prefix).catch(() => null);
        setMessage(r?.message ?? '만들지 못했어요.');
        if (r) router.refresh();
      });
    }}>
      <label htmlFor="prefix" className="text-ink-soft">코드 없는 차시에 짧은 코드 만들기: 앞글자</label>
      <input id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={12} pattern="[a-z]{2,12}"
        className="w-24 rounded-lg border border-line-strong bg-paper px-2 py-1 font-mono text-sm" />
      <span className="font-mono text-xs text-mute">→ {prefix || '??'}01, {prefix || '??'}02 …</span>
      <button disabled={pending} className="rounded-lg border border-mocha px-3 py-1 text-xs text-mocha-deep hover:bg-mocha-tint disabled:opacity-50">
        {pending ? '만드는 중…' : '만들기'}
      </button>
      {message && <span role="status" className="text-xs text-mute">{message}</span>}
    </form>
  );
}
