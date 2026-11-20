'use client';
// 신고 처리 버튼들 (ADM-02). 지우기·정지는 한 번 더 확인한다.
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { moderate, setUploadBan, type ModerationAction } from './actions';

const buttonClass = 'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40';

export function ModerationButtons({ target, targetId, status }: { target: 'post' | 'comment'; targetId: string; status: 'visible' | 'hidden' }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const what = target === 'post' ? '결과물' : '댓글';

  const run = (action: ModerationAction) => {
    if (action === 'delete' && !window.confirm(target === 'post'
      ? '이 결과물을 지울까요?\n바로 안 보이고, 30일 뒤 완전히 지워져요.'
      : '이 댓글을 지울까요? 바로 완전히 지워지고 되돌릴 수 없어요.')) return;
    setMessage('');
    startTransition(async () => {
      const result = await moderate({ action, target, targetId }).catch(() => null);
      setMessage(result?.message ?? '처리하지 못했어요.');
      if (result?.ok) router.refresh();
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === 'hidden' ? (
        <button type="button" disabled={pending} onClick={() => run('restore')} className={`${buttonClass} border-tendril text-ink hover:bg-cream`}>
          문제없음 · 다시 보이기
        </button>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => run('dismiss')} className={`${buttonClass} border-line-strong text-ink-soft hover:border-mocha`}>
            문제없음 · 신고 닫기
          </button>
          <button type="button" disabled={pending} onClick={() => run('hide')} className={`${buttonClass} border-mocha text-mocha-deep hover:bg-mocha-tint`}>
            {what} 숨기기
          </button>
        </>
      )}
      <button type="button" disabled={pending} onClick={() => run('delete')} className={`${buttonClass} border-mocha bg-mocha text-white hover:bg-mocha-deep`}>
        {what} 지우기
      </button>
      {message && <span role="status" className="text-xs text-mute">{message}</span>}
    </div>
  );
}

export function BanControls({ userId, nickname, banned }: { userId: string; nickname: string; banned: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const run = (days: number | null) => {
    const label = days === 0 ? '업로드 정지를 풀까요?' : days === null ? '풀 때까지 업로드를 정지할까요?' : `${days}일 동안 업로드를 정지할까요?`;
    if (!window.confirm(`${nickname}님 — ${label}\n정지되면 결과물·댓글·이미지를 올릴 수 없어요. 좋아요·보기는 그대로예요.`)) return;
    const reason = days === 0 ? '' : (window.prompt('정지 사유를 적어 주세요(관리자만 봐요, 선택).') ?? '');
    setMessage('');
    startTransition(async () => {
      const result = await setUploadBan({ userId, days, reason }).catch(() => null);
      setMessage(result?.message ?? '처리하지 못했어요.');
      if (result?.ok) router.refresh();
    });
  };

  if (banned) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-white">업로드 정지 중</span>
        <button type="button" disabled={pending} onClick={() => run(0)} className={`${buttonClass} border-line-strong text-ink-soft hover:border-mocha`}>정지 풀기</button>
        {message && <span role="status" className="text-xs text-mute">{message}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
      <span>글쓴이 업로드 정지:</span>
      {[7, 30].map((d) => (
        <button key={d} type="button" disabled={pending} onClick={() => run(d)} className={`${buttonClass} border-line-strong text-ink-soft hover:border-mocha`}>{d}일</button>
      ))}
      <button type="button" disabled={pending} onClick={() => run(null)} className={`${buttonClass} border-line-strong text-ink-soft hover:border-mocha`}>풀 때까지</button>
      {message && <span role="status" className="text-xs text-mute">{message}</span>}
    </div>
  );
}
