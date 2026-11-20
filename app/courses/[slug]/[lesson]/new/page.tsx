import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
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
  if ((await readNickname(await createUserClient({ readOnly: true }), user.id)) === null) redirect(nicknameSetupPath(here));

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <Link href={coursePath(course.slug, key, lesson.number)} className="text-sm text-mute hover:text-mocha">← {lesson.number}차시 {lesson.title}</Link>
      <p className="eyebrow mt-4">{course.title}</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">내 결과물 올리기</h1>
      <p className="mt-2 text-sm text-mute">한 차시에 하루 3개까지 올릴 수 있어요.</p>
      <div className="mt-8"><NewPostForm slug={course.slug} accessKey={key} lesson={lesson.number} /></div>
    </main>
  );
}
