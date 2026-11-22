import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
import { galleryImageUrl, isPostId, linkLabel, postPath } from '@/lib/gallery/model';
import { BANNED_MESSAGE, commentsForViewer, isUploadBanned, postForViewer } from '@/lib/gallery/store';
import Comments from '@/components/gallery/Comments';
import DeletePostButton from '@/components/gallery/DeletePostButton';
import ReportButton from '@/components/gallery/ReportButton';
import LikeButton from '@/components/gallery/LikeButton';
import { nicknameSetupPath } from '@/lib/profile/nickname';
import { signupState } from '@/lib/profile/setup';
import { pickShareImage, plainSummary, shareMetadata } from '@/lib/share/meta';
import { createUserClient, currentUser } from '@/lib/supabase/server';
import { loadCourse } from '../../../../data';
import { VisibilityNote } from '../../../../ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; lesson: string; postId: string }>; searchParams: Promise<{ key?: string | string[]; updated?: string }> };

// generateMetadata와 화면이 같은 요청에서 한 번만 읽도록 cache
const loadPost = cache(async (slug: string, rawLesson: string, postId: string, rawKey: string | string[] | undefined) => {
  const number = parseLessonNumber(rawLesson);
  if (!number || !isPostId(postId)) return null;
  const data = await loadCourse(slug, rawKey);
  const lesson = data?.lessons.find((l) => l.number === number);
  if (!data || !lesson) return null;
  const post = await postForViewer(await createUserClient({ readOnly: true }), data.course.slug, data.key, number, postId).catch(() => null);
  return post ? { ...data, lesson, post } : null;
});

async function load({ params, searchParams }: Props) {
  const { slug, lesson, postId } = await params;
  return loadPost(slug, lesson, postId, (await searchParams).key);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  if (!data) return { title: '결과물을 찾을 수 없어요 — ClassFlow', robots: { index: false } };
  const { course, lesson, post, key } = data;
  const open = course.visibility === 'public' && post.status === 'visible';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  // 숨긴 글(본인만 봄)은 미리보기에 내용을 싣지 않는다.
  const visible = post.status === 'visible';
  return shareMetadata({
    title: `${post.title} · ${lesson.number}차시 ${course.title} — ClassFlow`,
    shareTitle: visible ? `${post.title} — ${post.author}` : `${lesson.number}차시 결과물`,
    description: visible
      ? [plainSummary(post.body, 80), `${course.title} ${lesson.number}차시 · ♥ ${post.like_count}`].filter(Boolean).join(' · ')
      : `${course.title} ${lesson.number}차시`,
    path: postPath(coursePath(course.slug, key, lesson.number), post.id),
    image: pickShareImage(visible && post.images[0] && supabaseUrl ? galleryImageUrl(supabaseUrl, post.images[0]) : null, lesson.example_image_url, course.cover_url),
    imageAlt: visible ? post.title : `${lesson.number}차시 결과물`,
    index: open,
  });
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// 결과물 상세 (GAL-상세): 이미지 크게 · 링크 · 소개 전문 · 좋아요(GAL-03) · 댓글(GAL-04).
export default async function PostPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { course, lesson, post, key } = data;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const lessonPath = coursePath(course.slug, key, lesson.number);
  const backPath = lessonPath + '#posts';
  const here = postPath(lessonPath, post.id);
  const user = await currentUser();
  const loginPath = user ? null : '/login?next=' + encodeURIComponent(here);
  const client = await createUserClient({ readOnly: true });
  const [signup, comments, banned] = await Promise.all([
    user ? signupState(client, user.id) : null,
    post.status === 'visible' ? commentsForViewer(client, course.slug, key, post.id).catch(() => []) : [],
    user ? isUploadBanned(client) : false,
  ]);
  const nicknamePath = user && signup && !signup.complete ? nicknameSetupPath(here) : null; // 닉네임·약관 동의가 없으면 그 화면으로
  const updated = (await props.searchParams).updated === '1';

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <VisibilityNote course={course} />
      <Link href={backPath} className="mt-4 inline-block text-sm text-mute hover:text-mocha">← {lesson.number}차시 {lesson.title}</Link>

      {updated && <p role="status" className="mt-4 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">고친 내용을 저장했어요.</p>}
      {post.status === 'hidden' && (
        <p role="status" className="mt-4 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">
          신고가 쌓여 다른 사람에게는 숨겨진 결과물이에요. 지금은 나만 볼 수 있어요.
        </p>
      )}

      <article className="mt-4">
        <h1 className="text-2xl font-bold leading-snug text-ink break-words">{post.title}</h1>
        <p className="mt-2 text-sm text-mute">
          {post.author}{post.is_mine && ' (나)'} · <time dateTime={post.created_at}>{dateFormat.format(new Date(post.created_at))}</time>
        </p>

        {post.images.length > 0 && (
          <div className="mt-6 grid gap-3">
            {post.images.map((path, i) => {
              const src = galleryImageUrl(supabaseUrl, path);
              return (
                <a key={path} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-line bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소 */}
                  <img src={src} alt={`${post.title} 이미지 ${i + 1}`} className="w-full" loading={i === 0 ? 'eager' : 'lazy'} />
                </a>
              );
            })}
            <p className="text-xs text-mute">이미지를 누르면 원본 크기로 열려요.</p>
          </div>
        )}

        {post.body && <p className="mt-6 whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{post.body}</p>}

        {post.links.length > 0 && (
          <section aria-label="링크" className="mt-6 grid gap-2">
            {post.links.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow ugc"
                className="flex min-w-0 items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm text-mocha-deep hover:border-mocha hover:bg-mocha-tint">
                <span aria-hidden>🔗</span>
                <span className="min-w-0 truncate">{linkLabel(url)}</span>
                <span aria-hidden className="ml-auto text-mute">↗</span>
              </a>
            ))}
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm text-mute">
          {post.status === 'visible' ? (
            <LikeButton key={post.id} slug={course.slug} accessKey={key} lesson={lesson.number} postId={post.id}
              liked={post.liked} count={post.like_count} loginPath={loginPath} />
          ) : (
            <span aria-label={`좋아요 ${post.like_count}개`}>♥ {post.like_count}</span>
          )}
          <span aria-label={`댓글 ${post.comment_count}개`}>💬 {post.comment_count}</span>
          {post.is_mine && (
            <span className="ml-auto flex items-start gap-2">
              {post.status === 'visible' && (
                <Link href={here.replace(/(\?|$)/, '/edit$1')} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft hover:border-mocha hover:text-mocha">고치기</Link>
              )}
              <DeletePostButton slug={course.slug} accessKey={key} lesson={lesson.number} postId={post.id} />
            </span>
          )}
          {!post.is_mine && post.status === 'visible' && (
            <>
              <span className="ml-auto" />
              <ReportButton slug={course.slug} accessKey={key} lesson={lesson.number} postId={post.id} target="post" targetId={post.id} loginPath={loginPath} />
            </>
          )}
        </div>
      </article>

      {post.status === 'visible' && (
        <Comments slug={course.slug} accessKey={key} lesson={lesson.number} postId={post.id} loginPath={loginPath} nicknamePath={nicknamePath} bannedMessage={banned ? BANNED_MESSAGE : null}
          comments={comments.map((c) => ({ id: c.id, body: c.body, author: c.author, is_mine: c.is_mine, time: dateFormat.format(new Date(c.created_at)) }))} />
      )}

      <Link href={backPath} className="mt-10 block rounded-2xl border border-line-strong px-6 py-3 text-center text-sm font-medium text-ink hover:border-mocha hover:text-mocha">
        이 차시 결과물 더 보기
      </Link>
    </main>
  );
}
