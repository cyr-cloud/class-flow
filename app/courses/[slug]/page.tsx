import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CHANNELS, coursePath } from '@/lib/course/model';
import { lessonPostCounts } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';
import { loadCourse } from '../data';
import { VisibilityNote } from '../ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ key?: string | string[] }> };

const WATCH_LABEL: Record<string, string> = { youtube: '유튜브에서 강의 보기', inflearn: '인프런에서 강의 보기' };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const data = await loadCourse((await params).slug, (await searchParams).key);
  if (!data) return { title: '강의를 찾을 수 없어요 — ClassFlow', robots: { index: false } };
  const { course } = data;
  return {
    title: `${course.title} — ClassFlow`,
    description: course.description.slice(0, 120) || undefined,
    // 링크 공개·준비 중 강의는 검색에 나오면 안 된다.
    robots: course.visibility === 'public' ? undefined : { index: false, follow: false },
  };
}

// 강의 소개 + 차시 목록 (HOME-02). 모바일 우선.
export default async function CoursePage({ params, searchParams }: Props) {
  const data = await loadCourse((await params).slug, (await searchParams).key);
  if (!data) notFound();
  const { course, lessons, key } = data;
  const counts = await lessonPostCounts(await createUserClient({ readOnly: true }), course.slug, key).catch(() => new Map<number, number>());

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <VisibilityNote course={course} />
      {course.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element -- 강사가 넣은 외부 주소라 next/image 도메인 설정을 쓰지 않는다
        <img src={course.cover_url} alt="" className="mt-6 aspect-video w-full rounded-2xl border border-line object-cover" />
      )}
      <p className="eyebrow mt-6">{CHANNELS[course.channel]} 강의</p>
      <h1 className="mt-2 text-2xl font-bold leading-snug text-ink sm:text-3xl">{course.title}</h1>
      {course.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">{course.description}</p>}
      {course.external_url && (
        <a
          href={course.external_url} target="_blank" rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1 rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink hover:border-mocha hover:text-mocha"
        >
          {WATCH_LABEL[course.channel] ?? '강의 보러 가기'} ↗
        </a>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-ink">차시 {lessons.length}개</h2>
        {lessons.length === 0 ? (
          <p className="mt-3 text-sm text-mute">아직 등록된 차시가 없어요.</p>
        ) : (
          <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link href={coursePath(course.slug, key, l.number)} className="flex items-center gap-3 px-4 py-4 hover:bg-cream">
                  <span className="w-12 shrink-0 text-sm text-mute">{l.number}차시</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{l.title}</span>
                  {(counts.get(l.number) ?? 0) > 0 && <span className="shrink-0 text-xs text-mute">결과물 {counts.get(l.number)}</span>}
                  <span aria-hidden className="text-mute">›</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-mute">차시마다 실습 안내를 보고, 내 결과물을 올리고, 다른 사람 결과물을 구경할 수 있어요.</p>
      </section>
    </main>
  );
}
