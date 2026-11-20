import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
import { galleryImageUrl, isPostId, postPath } from '@/lib/gallery/model';
import { BANNED_MESSAGE, isUploadBanned, postForViewer } from '@/lib/gallery/store';
import { nicknameSetupPath } from '@/lib/profile/nickname';
import { signupState } from '@/lib/profile/setup';
import { createUserClient, currentUser } from '@/lib/supabase/server';
import { loadCourse } from '../../../../../data';
import NewPostForm from '../../../new/NewPostForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '결과물 고치기 — ClassFlow', robots: { index: false } };

type Props = { params: Promise<{ slug: string; lesson: string; postId: string }>; searchParams: Promise<{ key?: string | string[] }> };

// 결과물 고치기 (GAL-05). 내 결과물이고 숨겨지지 않았을 때만 연다. 남의 것이면 404.
export default async function EditPostPage({ params, searchParams }: Props) {
  const { slug, lesson: rawLesson, postId } = await params;
  const number = parseLessonNumber(rawLesson);
  const data = number && isPostId(postId) ? await loadCourse(slug, (await searchParams).key) : null;
  const lesson = data?.lessons.find((l) => l.number === number);
  if (!data || !lesson) notFound();
  const { course, key } = data;

  const detail = postPath(coursePath(course.slug, key, lesson.number), postId);
  const here = detail.replace(/(\?|$)/, '/edit$1');
  const user = await currentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(here));
  const client = await createUserClient({ readOnly: true });
  const post = await postForViewer(client, course.slug, key, lesson.number, postId).catch(() => null);
  if (!post || !post.is_mine || post.status !== 'visible') notFound();
  const [signup, banned] = await Promise.all([signupState(client, user.id), isUploadBanned(client)]);
  if (!signup.complete) redirect(nicknameSetupPath(here));
  const nickname = signup.nickname;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <Link href={detail} className="text-sm text-mute hover:text-mocha">← 고치지 않고 돌아가기</Link>
      <p className="eyebrow mt-4">{course.title} · {lesson.number}차시</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">결과물 고치기</h1>
      {banned ? (
        <p role="status" className="mt-8 rounded-2xl border border-line bg-cream px-5 py-6 text-center text-sm leading-relaxed text-ink-soft">{BANNED_MESSAGE}</p>
      ) : (
      <div className="mt-8">
        <NewPostForm slug={course.slug} accessKey={key} lesson={lesson.number} author={nickname ?? '나'}
          edit={{ postId: post.id, title: post.title, body: post.body, links: post.links,
            images: post.images.map((path) => ({ path, url: galleryImageUrl(supabaseUrl, path) })) }} />
      </div>
      )}
    </main>
  );
}
