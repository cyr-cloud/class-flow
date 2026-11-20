import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
import { DAILY_POST_LIMIT, postsLeftToday } from '@/lib/gallery/model';
import { myPostsToday } from '@/lib/gallery/store';
import { nicknameSetupPath } from '@/lib/profile/nickname';
import { readNickname } from '@/lib/profile/store';
import { createUserClient, currentUser } from '@/lib/supabase/server';
import { loadCourse } from '../../../data';
import NewPostForm from './NewPostForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '결과물 올리기 — ClassFlow', robots: { index: false } };

type Props = { params: Promise<{ slug: string; lesson: string }>; searchParams: Promise<{ key?: string | string[] }> };

// 결과물 올리기 (GAL-01). 로그인·닉네임이 없으면 먼저 거기로 보냈다가 이 화면으로 돌아온다.
export default async function NewPostPage({ params, searchParams }: Props) {
  const { slug, lesson: rawLesson } = await params;
  const number = parseLessonNumber(rawLesson);
  const data = number ? await loadCourse(slug, (await searchParams).key) : null;
  const lesson = data?.lessons.find((l) => l.number === number);
  if (!data || !lesson) notFound();
  const { course, key } = data;

  const here = coursePath(course.slug, key, lesson.number).replace(/(\?|$)/, '/new$1');
  const user = await currentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(here));
  const client = await createUserClient({ readOnly: true });
  const nickname = await readNickname(client, user.id);
  if (nickname === null) redirect(nicknameSetupPath(here));
  const posted = await myPostsToday(client, course.slug, key, lesson.number);
  const left = posted === null ? null : postsLeftToday(posted);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <Link href={coursePath(course.slug, key, lesson.number)} className="text-sm text-mute hover:text-mocha">← {lesson.number}차시 {lesson.title}</Link>
      <p className="eyebrow mt-4">{course.title}</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">내 결과물 올리기</h1>
      {/* GAL-07: 남은 개수를 미리 알려 주고, 다 쓰면 폼 대신 안내만 보여 준다 */}
      <p className="mt-2 text-sm text-mute">
        한 차시에 하루 {DAILY_POST_LIMIT}개까지 올릴 수 있어요.
        {left !== null && left > 0 && <> 오늘 <b className="text-ink">{left}개</b> 더 올릴 수 있어요.</>}
      </p>
      {left === 0 ? (
        <div role="status" className="mt-8 rounded-2xl border border-line bg-cream px-5 py-6 text-center">
          <p className="font-semibold text-ink">오늘은 이 차시에 {DAILY_POST_LIMIT}개를 모두 올렸어요</p>
          <p className="mt-2 text-sm leading-relaxed text-mute">지운 결과물도 세어져요. 내일(한국 시간 자정 이후) 다시 올릴 수 있어요.<br />이미 올린 결과물은 고칠 수 있어요.</p>
          <Link href={coursePath(course.slug, key, lesson.number) + '#posts'} className="mt-4 inline-block rounded-xl border border-line-strong px-5 py-2.5 text-sm text-ink hover:border-mocha hover:text-mocha">
            {lesson.number}차시 결과물 보러 가기
          </Link>
        </div>
      ) : (
        <div className="mt-8"><NewPostForm slug={course.slug} accessKey={key} lesson={lesson.number} author={nickname ?? '나'} /></div>
      )}
    </main>
  );
}
