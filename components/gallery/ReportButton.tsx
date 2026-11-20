'use client';
// 신고 버튼 (GAL-06): 누르면 사유 고르기 칸이 펼쳐진다. 서로 다른 3명이 신고하면 자동으로 숨겨진다.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { reportContent } from '@/app/courses/actions';
import { REPORT_DETAIL_MAX, REPORT_HIDE_AT, REPORT_REASONS } from '@/lib/gallery/model';

type Props = {
  slug: string; accessKey: string | null; lesson: number; postId: string;
  target: 'post' | 'comment'; targetId: string;
  loginPath: string | null; // 로그인 안 했으면 로그인 주소
};

export default function ReportButton({ slug, accessKey, lesson, postId, target, targetId, loginPath }: Props) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const what = target === 'post' ? '결과물' : '댓글';

  if (loginPath) {
    return <Link href={loginPath} className="text-xs text-mute underline-offset-2 hover:text-mocha hover:underline">신고</Link>;
  }
  if (done) return <span role="status" className="text-xs text-mute">신고를 접수했어요. 고마워요.</span>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    startTransition(async () => {
      const result = await reportContent({ slug, key: accessKey, lesson, postId, target, targetId, reason, detail }).catch(() => null);
      if (result?.ok) { setDone(true); setOpen(false); if (target === 'comment') router.refresh(); }
      else setMessage(result && !result.ok ? result.message : '신고하지 못했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
        className="text-xs text-mute underline-offset-2 hover:text-mocha hover:underline">신고</button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 w-full basis-full rounded-xl border border-line-strong bg-paper p-4 text-sm" aria-label={`${what} 신고`}>
      <p className="font-medium text-ink">이 {what}을 신고할까요?</p>
      <p className="mt-1 text-xs text-mute">서로 다른 {REPORT_HIDE_AT}명이 신고하면 자동으로 숨겨지고 관리자가 확인해요. 누가 신고했는지는 글쓴이에게 보이지 않아요.</p>
      <fieldset className="mt-3 grid gap-1.5">
        <legend className="sr-only">신고 사유</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-ink-soft">
            <input type="radio" name={`${id}-reason`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-mocha" />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-detail`} className="mt-3 block text-xs text-mute">
        자세한 내용 {reason === 'other' ? '(기타는 꼭 적어 주세요)' : '(선택)'}
      </label>
      <textarea id={`${id}-detail`} rows={2} maxLength={REPORT_DETAIL_MAX} value={detail} onChange={(e) => setDetail(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-mocha" />
      {message && <p role="alert" className="mt-2 text-xs text-mocha-deep">{message}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setMessage(''); }} className="rounded-lg px-3 py-1.5 text-xs text-mute hover:text-ink">취소</button>
        <button disabled={!reason || pending || (reason === 'other' && !detail.trim())}
          className="rounded-lg bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:bg-mocha-deep disabled:opacity-40">
          {pending ? '보내는 중…' : '신고하기'}
        </button>
      </div>
    </form>
  );
}
