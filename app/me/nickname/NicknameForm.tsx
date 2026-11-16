'use client';
import { useState } from 'react';
import { checkNickname, NICKNAME_MAX } from '@/lib/profile/nickname';

export default function NicknameForm({ initial, next, first }: { initial: string; next: string; first: boolean }) {
  const [nickname, setNickname] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    const checked = checkNickname(nickname);
    if (!checked.ok) { setMessage(checked.message); return; }
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/profile/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: checked.value, next }),
      });
      const data = await r.json();
      if (r.ok) { window.location.assign(data.next); return; }
      if (r.status === 401) { window.location.assign('/login?next=' + encodeURIComponent('/me/nickname')); return; }
      setMessage(data.message);
    } catch {
      setMessage('연결하지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label htmlFor="nickname" className="text-sm font-medium text-ink">닉네임</label>
      <input
        id="nickname" autoComplete="nickname" required minLength={2} maxLength={NICKNAME_MAX} autoFocus
        value={nickname} disabled={busy} onChange={(e) => setNickname(e.target.value)}
        placeholder="예: 코딩하는곰"
        className="mt-2 w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-ink outline-none focus:border-mocha disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-mute">2~{NICKNAME_MAX}자 · 한글·영문·숫자, 공백·점·밑줄·하이픈</p>
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-mocha-deep">{message}</p>
      <button
        disabled={busy}
        className="mt-2 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-50"
      >
        {busy ? '저장 중…' : first ? '이 이름으로 시작하기' : '저장'}
      </button>
    </form>
  );
}
