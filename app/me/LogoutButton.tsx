'use client';
import { useState } from 'react';

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (r.ok) { window.location.assign('/'); return; }
      setMessage((await r.json()).message);
    } catch {
      setMessage('연결하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        onClick={() => void logout()} disabled={busy}
        className="rounded-full border border-line-strong px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-50"
      >
        {busy ? '로그아웃 중…' : '로그아웃'}
      </button>
      {message && <p role="status" className="mt-3 text-sm text-mocha-deep">{message}</p>}
    </>
  );
}
