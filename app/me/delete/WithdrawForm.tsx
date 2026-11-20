'use client';
import { useState } from 'react';
import { WITHDRAW_PHRASE, checkWithdrawPhrase } from '@/lib/profile/withdraw';

export default function WithdrawForm() {
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState<'deleted' | 'classflow_only' | null>(null);
  const ready = checkWithdrawPhrase(phrase);

  async function withdraw() {
    if (!ready || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/profile/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: phrase }) });
      const data = await r.json();
      if (r.ok) { setDone(data.result); return; }
      if (r.status === 401) { window.location.assign('/login?next=/me/delete'); return; }
      setMessage(data.message);
    } catch {
      setMessage('연결하지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-line px-5 py-6 text-center">
        <p className="font-semibold text-ink">{done === 'deleted' ? '탈퇴했어요. 그동안 고마웠어요.' : 'ClassFlow 정보를 모두 지웠어요.'}</p>
        {done === 'classflow_only' && <p className="mt-2 text-sm text-mute">스토어 구매 기록 때문에 로그인 계정은 남아 있어요.</p>}
        {/* 로그아웃된 상태를 화면 전체에 반영하려고 새로 불러온다 */}
        <button type="button" onClick={() => window.location.assign('/')} className="mt-4 inline-block rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft hover:border-mocha hover:text-mocha">첫 화면으로</button>
      </div>
    );
  }

  return (
    <form className="mt-8" onSubmit={(e) => { e.preventDefault(); void withdraw(); }}>
      <label htmlFor="withdraw" className="text-sm text-ink">확인을 위해 <b>{WITHDRAW_PHRASE}</b>를 그대로 적어 주세요.</label>
      <input id="withdraw" value={phrase} onChange={(e) => setPhrase(e.target.value)} disabled={busy} autoComplete="off" placeholder={WITHDRAW_PHRASE}
        className="mt-2 w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-ink outline-none focus:border-mocha disabled:opacity-60" />
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-mocha-deep">{message}</p>
      <button disabled={!ready || busy}
        className="mt-2 w-full rounded-full bg-mocha px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-mocha-deep disabled:opacity-40">
        {busy ? '지우는 중…' : '모든 정보를 지우고 탈퇴하기'}
      </button>
    </form>
  );
}
