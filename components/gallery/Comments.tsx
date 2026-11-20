'use client';
// 결과물 댓글 (GAL-04): 한 단계 목록 + 쓰기(300자) + 내 댓글 지우기. 쓰거나 지우면 화면을 서버에서 다시 받는다.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addComment, deleteComment } from '@/app/courses/actions';
import ReportButton from '@/components/gallery/ReportButton';
import { COMMENT_MAX } from '@/lib/gallery/model';

export interface CommentView { id: string; body: string; author: string; is_mine: boolean; time: string }

type Props = {
  slug: string; accessKey: string | null; lesson: number; postId: string;
  comments: CommentView[];
  // 쓰기 막힘 사유: 로그인 필요 → 로그인 주소, 닉네임 필요 → 닉네임 설정 주소
  loginPath: string | null; nicknamePath: string | null;
  bannedMessage?: string | null; // 업로드 정지(ADM-02)면 쓰기 칸 대신 안내
};

export default function Comments({ slug, accessKey, lesson, postId, comments, loginPath, nicknamePath, bannedMessage }: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const target = { slug, key: accessKey, lesson, postId };
  const length = [...body.trim()].length;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setMessage('');
    startTransition(async () => {
      const result = await addComment({ ...target, body }).catch(() => null);
      if (result?.ok) { setBody(''); router.refresh(); }
      else setMessage(result && !result.ok ? result.message : '댓글을 올리지 못했어요. 잠시 후 다시 시도해주세요.');
    });
  };

  const remove = (id: string) => {
    if (!window.confirm('이 댓글을 지울까요? 되돌릴 수 없어요.')) return;
    setMessage('');
    startTransition(async () => {
      const result = await deleteComment({ ...target, commentId: id }).catch(() => null);
      if (result?.ok) router.refresh();
      else setMessage(result && !result.ok ? result.message : '댓글을 지우지 못했어요.');
    });
  };

  return (
    <section aria-labelledby="comments" className="mt-8">
      <h2 id="comments" className="text-base font-semibold text-ink">댓글 {comments.length > 0 ? comments.length : ''}</h2>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-mute">아직 댓글이 없어요. 첫 응원을 남겨 보세요!</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-cream px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                <span className="font-medium text-ink-soft">{c.author}{c.is_mine && ' (나)'}</span>
                <span>{c.time}</span>
                {c.is_mine && (
                  <button type="button" onClick={() => remove(c.id)} disabled={pending}
                    className="ml-auto text-mute underline-offset-2 hover:text-mocha hover:underline disabled:opacity-50">지우기</button>
                )}
                {!c.is_mine && (
                  <>
                    <span className="ml-auto" />
                    <ReportButton slug={slug} accessKey={accessKey} lesson={lesson} postId={postId} target="comment" targetId={c.id} loginPath={loginPath} />
                  </>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {loginPath ? (
        <Link href={loginPath} className="mt-4 block rounded-xl border border-dashed border-line-strong px-4 py-3 text-center text-sm text-mute hover:border-mocha hover:text-mocha">
          로그인하고 댓글 쓰기
        </Link>
      ) : bannedMessage ? (
        <p className="mt-4 rounded-xl bg-cream px-4 py-3 text-center text-sm text-mute">{bannedMessage}</p>
      ) : nicknamePath ? (
        <Link href={nicknamePath} className="mt-4 block rounded-xl border border-dashed border-line-strong px-4 py-3 text-center text-sm text-mute hover:border-mocha hover:text-mocha">
          닉네임·가입 확인하고 댓글 쓰기
        </Link>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <label htmlFor="comment" className="sr-only">댓글</label>
          <textarea id="comment" rows={3} maxLength={COMMENT_MAX + 20} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="응원이나 궁금한 점을 남겨 주세요."
            className="w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-mocha" />
          <div className="mt-2 flex items-center gap-3">
            <span className={`text-xs ${length > COMMENT_MAX ? 'text-mocha-deep' : 'text-mute'}`}>{length}/{COMMENT_MAX}자</span>
            <button disabled={pending || length === 0 || length > COMMENT_MAX}
              className="ml-auto rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-mocha-deep disabled:opacity-40">
              {pending ? '올리는 중…' : '댓글 쓰기'}
            </button>
          </div>
        </form>
      )}
      {message && <p role="alert" className="mt-2 text-xs text-mocha-deep">{message}</p>}
    </section>
  );
}
