'use client';
import { useState } from 'react';
import { checkConsents, MIN_SIGNUP_AGE } from '@/lib/legal/documents';
import { checkNickname, NICKNAME_MAX } from '@/lib/profile/nickname';

// needConsent: 지금 판 약관·처리방침·만 14세 확인이 없을 때 체크란을 보여 준다(LEGAL-04·05). 미리 체크해 두지 않는다.
export default function NicknameForm({ initial, next, first, needConsent }: { initial: string; next: string; first: boolean; needConsent: boolean }) {
  const [nickname, setNickname] = useState(initial);
  const [consents, setConsents] = useState({ age14: false, terms: false, privacy: false });
  const allChecked = consents.age14 && consents.terms && consents.privacy;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    const checked = checkNickname(nickname);
    if (!checked.ok) { setMessage(checked.message); return; }
    if (needConsent) {
      const consent = checkConsents(consents);
      if (!consent.ok) { setMessage(consent.message); return; }
    }
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/profile/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: checked.value, next, ...(needConsent ? { consents } : {}) }),
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

      {needConsent && (
        <fieldset className="mt-6 rounded-2xl border border-line-strong px-4 py-4" disabled={busy}>
          <legend className="px-1 text-sm font-medium text-ink">가입 확인 (모두 필수)</legend>
          <label className="flex items-center gap-2.5 border-b border-line pb-3 text-sm font-semibold text-ink">
            <input type="checkbox" className="h-4 w-4 accent-mocha" checked={allChecked}
              onChange={(e) => setConsents({ age14: e.target.checked, terms: e.target.checked, privacy: e.target.checked })} />
            아래 내용에 모두 동의해요
          </label>
          <div className="mt-3 grid gap-2.5 text-sm text-ink-soft">
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-mocha" checked={consents.age14} onChange={(e) => setConsents((c) => ({ ...c, age14: e.target.checked }))} />
              <span>(필수) <b className="text-ink">만 {MIN_SIGNUP_AGE}세 이상</b>이에요. 만 {MIN_SIGNUP_AGE}세 미만은 가입할 수 없어요.</span>
            </label>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-mocha" checked={consents.terms} onChange={(e) => setConsents((c) => ({ ...c, terms: e.target.checked }))} />
              <span>(필수) <a href="/terms" target="_blank" rel="noopener" className="text-mocha underline underline-offset-2">이용약관</a>에 동의해요.</span>
            </label>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-mocha" checked={consents.privacy} onChange={(e) => setConsents((c) => ({ ...c, privacy: e.target.checked }))} />
              <span>(필수) <a href="/privacy" target="_blank" rel="noopener" className="text-mocha underline underline-offset-2">개인정보 수집·이용</a>에 동의해요. (이메일·닉네임·올린 결과물 등, 탈퇴할 때까지 보관)</span>
            </label>
          </div>
        </fieldset>
      )}
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-sm text-mocha-deep">{message}</p>
      <button
        disabled={busy || (needConsent && !allChecked)}
        className="mt-2 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-50"
      >
        {busy ? '저장 중…' : first ? '이 이름으로 시작하기' : '저장'}
      </button>
    </form>
  );
}
