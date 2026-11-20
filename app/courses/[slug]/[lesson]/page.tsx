import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
import { loadCourse } from '../../data';
import { VisibilityNote } from '../../ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; lesson: string }>; searchParams: Promise<{ key?: string | string[] }> };

async function load({ params, searchParams }: Props) {
  const { slug, lesson } = await params;
  const number = parseLessonNumber(lesson);
  if (!number) return null;
  const data = await loadCourse(slug, (await searchParams).key);
  if (!data) return null;
  const index = data.lessons.findIndex((l) => l.number === number);
  if (index < 0) return null;
  return { ...data, lesson: data.lessons[index], prev: data.lessons[index - 1] ?? null, next: data.lessons[index + 1] ?? null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  if (!data) return { title: '차시를 찾을 수 없어요 — ClassFlow', robots: { index: false } };
  return {
    title: `${data.lesson.number}차시 ${data.lesson.title} · ${data.course.title} — ClassFlow`,
    robots: data.course.visibility === 'public' ? undefined : { index: false, follow: false },
  };
}

// 차시 페이지 (HOME-03): 실습 안내 → 내 결과물 올리기 → 다른 결과물 → 이전·다음 차시. 모바일 우선.
export default async function LessonPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { course, lessons, lesson, prev, next, key } = data;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <VisibilityNote course={course} />
      <Link href={coursePath(course.slug, key)} className="mt-4 inline-block text-sm text-mute hover:text-mocha">← {course.title}</Link>
      <p className="eyebrow mt-4">{lesson.number}차시 / {lessons.length}</p>
      <h1 className="mt-2 text-2xl font-bold leading-snug text-ink">{lesson.title}</h1>

      <section aria-labelledby="guide" className="mt-6 rounded-2xl border border-line bg-cream px-5 py-5">
        <h2 id="guide" className="eyebrow">실습 안내</h2>
        {lesson.guide_md.trim() ? (
          <div className="guide-markdown mt-3 text-[15px] leading-relaxed text-ink">
            <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
              {lesson.guide_md}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="mt-3 text-sm text-mute">이 차시는 아직 실습 안내가 없어요. 강의 영상을 따라 만들어 보세요.</p>
        )}
        {lesson.example_image_url && (
          <figure className="mt-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- 강사가 넣은 외부 주소 */}
            <img src={lesson.example_image_url} alt={`${lesson.title} 예시 결과`} className="w-full rounded-xl border border-line" />
            <figcaption className="mt-2 text-xs text-mute">예시 결과</figcaption>
          </figure>
        )}
      </section>

      {/* 결과물 올리기·목록은 갤러리(GAL) 작업에서 붙인다 */}
      <section className="mt-6">
        <button disabled className="w-full rounded-2xl bg-ink px-6 py-4 text-base font-semibold text-white disabled:opacity-40">
          내 결과물 올리기
        </button>
        <p className="mt-2 text-center text-xs text-mute">결과물 올리기는 곧 열려요.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-ink">다른 사람 결과물</h2>
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">아직 올라온 결과물이 없어요.</p>
      </section>

      <nav aria-label="차시 이동" className="mt-12 grid grid-cols-2 gap-3 border-t border-line pt-6">
        {prev ? (
          <Link href={coursePath(course.slug, key, prev.number)} className="min-w-0 rounded-xl border border-line px-4 py-3 hover:border-mocha">
            <span className="block text-xs text-mute">← 이전 {prev.number}차시</span>
            <span className="mt-1 block truncate text-sm text-ink">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={coursePath(course.slug, key, next.number)} className="min-w-0 rounded-xl border border-line px-4 py-3 text-right hover:border-mocha">
            <span className="block text-xs text-mute">다음 {next.number}차시 →</span>
            <span className="mt-1 block truncate text-sm text-ink">{next.title}</span>
          </Link>
        ) : <span />}
      </nav>
    </main>
  );
}
