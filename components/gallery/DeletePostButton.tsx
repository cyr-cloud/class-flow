'use client';
// 결과물 지우기 (GAL-05): 한 번 확인한 뒤 지운다. 성공하면 서버 동작이 차시 페이지로 보낸다.
import { useState, useTransition } from 'react';
import { deletePost } from '@/app/courses/actions';

export default function DeletePostButton(props: { slug: string; accessKey: string | null; lesson: number; postId: string }) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const remove = () => {
    if (!window.confirm('이 결과물을 지울까요?\n다른 사람에게 바로 안 보이고, 30일 뒤 완전히 지워져요.')) return;
    setMessage('');
    startTransition(async () => {
      const result = await deletePost({ slug: props.slug, key: props.accessKey, lesson: props.lesson, postId: props.postId });
      if (result && !result.ok) setMessage(result.message);
    });
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={remove} disabled={pending}
        className="rounded-full border border-line-strong px-4 py-2 text-sm text-mute hover:border-mocha hover:text-mocha disabled:opacity-50">
        {pending ? '지우는 중…' : '결과물 지우기'}
      </button>
      {message && <span role="alert" className="mt-1 text-xs text-mocha-deep">{message}</span>}
    </span>
  );
}
