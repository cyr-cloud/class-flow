'use client';
// 좋아요 버튼 (GAL-03): 누르면 바로 바뀌어 보이고(낙관적 표시), 서버 결과로 다시 맞춘다. 실패하면 원래대로 돌아간다.
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setLike } from '@/app/courses/actions';

type Props = { slug: string; accessKey: string | null; lesson: number; postId: string; liked: boolean; count: number; loginPath: string | null };

export default function LikeButton({ slug, accessKey, lesson, postId, liked: initialLiked, count: initialCount, loginPath }: Props) {
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const label = `좋아요 ${state.count}개`;

  // 로그인 안 했으면 로그인 화면으로 보냈다가 이 결과물로 돌아온다
  if (loginPath) {
    return (
      <Link href={loginPath} aria-label={`${label} — 로그인하고 누르기`}
        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft hover:border-mocha hover:text-mocha">
        <span aria-hidden>♡</span> {state.count}
      </Link>
    );
  }

  const toggle = () => {
    const before = state;
    const want = !before.liked;
    setMessage('');
    setState({ liked: want, count: Math.max(before.count + (want ? 1 : -1), 0) });
    startTransition(async () => {
      const result = await setLike({ slug, key: accessKey, lesson, postId, liked: want }).catch(() => null);
      if (result?.ok) setState({ liked: result.liked, count: result.count });
      else { setState(before); setMessage(result?.message ?? '좋아요를 처리하지 못했어요. 잠시 후 다시 시도해주세요.'); }
    });
  };

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={state.liked} aria-label={label}
        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-70 ${
          state.liked ? 'border-mocha bg-mocha-tint text-mocha-deep' : 'border-line-strong text-ink-soft hover:border-mocha hover:text-mocha'}`}>
        <span aria-hidden>{state.liked ? '♥' : '♡'}</span> {state.count}
      </button>
      {message && <span role="alert" className="mt-1 text-xs text-mocha-deep">{message}</span>}
    </span>
  );
}
