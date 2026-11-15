'use client';
import { useEffect, useState } from 'react';

const input =
  'mt-2 w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-ink outline-none focus:border-mocha disabled:opacity-60';
const subtle =
  'rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-50';

export default function LoginForm({ configured, next }: { configured: boolean; next: string }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function submit(action: 'request' | 'verify') {
    if (busy || !configured) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, next }),
      });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok && action === 'request') { setSent(true); setToken(''); setRemaining(60); }
      if (response.ok && action === 'verify') window.location.assign(data.next);
      if (response.status === 429) setRemaining(60);
    } catch {
      setMessage('연결하지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6" onSubmit={(e) => { e.preventDefault(); void submit(sent ? 'verify' : 'request'); }}>
      {!configured && (
        <p role="status" className="mb-6 rounded-xl border border-line-strong bg-cream px-4 py-3 text-sm text-ink-soft">
          로그인 서비스를 준비 중이에요. 수업 참여와 결과물 보기는 로그인 없이 이용할 수 있어요.
        </p>
      )}
      <label htmlFor="email" className="text-sm font-medium text-ink">이메일</label>
      <input
        id="email" type="email" autoComplete="email" required maxLength={254}
        value={email} readOnly={sent} disabled={!configured || busy}
        onChange={(e) => setEmail(e.target.value)} className={input}
      />
      {sent && (
        <>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            메일의 로그인 링크는 <b>이 브라우저</b>에서 열어주세요. 인증번호가 왔다면 아래에 입력하면 돼요.
          </p>
          <label htmlFor="token" className="mt-4 block text-sm font-medium text-ink">인증번호</label>
          <input
            id="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required minLength={6} maxLength={8}
            value={token} disabled={busy} onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} className={input}
          />
          <p className="mt-2 text-xs text-mute">메일이 안 보이면 스팸함도 확인해주세요.</p>
        </>
      )}
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-mocha-deep">{message}</p>
      <button
        disabled={!configured || busy}
        className="mt-2 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-50"
      >
        {busy ? '처리 중…' : sent ? '번호로 로그인' : '로그인 메일 받기'}
      </button>
      {sent && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy || remaining > 0} onClick={() => void submit('request')} className={subtle}>
            {remaining > 0 ? `${remaining}초 후 다시 받기` : '인증 메일 다시 받기'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setSent(false); setToken(''); setMessage(''); }} className={subtle}>
            이메일 바꾸기
          </button>
        </div>
      )}
    </form>
  );
}
