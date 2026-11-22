import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { coursePath, parseLessonNumber } from '@/lib/course/model';
import { MAX_PAGE, galleryImageUrl, linkLabel, parseListQuery, postListPath, postPath, type PostSort } from '@/lib/gallery/model';
import { lessonPostCounts, listPosts, postsForViewer } from '@/lib/gallery/store';
import { pickShareImage, plainSummary, shareMetadata } from '@/lib/share/meta';
import { createUserClient } from '@/lib/supabase/server';
import { loadCourse } from '../../data';
import { VisibilityNote } from '../../ui';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; lesson: string }>; searchParams: Promise<{ key?: string | string[]; posted?: string; deleted?: string; sort?: string | string[]; page?: string | string[] }> };

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
  const { course, lesson, key } = data;
  // 대표 이미지: 좋아요 많은 결과물 중 이미지가 있는 첫 글 → 차시 예시 이미지 → 강의 표지 → 기본 이미지
  const client = await createUserClient({ readOnly: true });
  const [top, counts] = await Promise.all([
    postsForViewer(client, course.slug, key, lesson.number, { sort: 'popular', limit: 12 }).catch(() => []),
    lessonPostCounts(client, course.slug, key).catch(() => new Map<number, number>()),
  ]);
  const featured = top.find((p) => p.status === 'visible' && p.images.length > 0);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const total = counts.get(lesson.number) ?? 0;
  const guide = plainSummary(lesson.guide_md, 80);
  return shareMetadata({
    title: `${lesson.number}차시 ${lesson.title} · ${course.title} — ClassFlow`,
    shareTitle: `${lesson.number}차시 ${lesson.title}`,
    description: [course.title, total > 0 ? `결과물 ${total}개` : '첫 결과물을 올려 보세요', guide].filter(Boolean).join(' · '),
    path: coursePath(course.slug, key, lesson.number),
    image: pickShareImage(featured && supabaseUrl ? galleryImageUrl(supabaseUrl, featured.images[0]) : null, lesson.example_image_url, course.cover_url),
    imageAlt: featured ? `${lesson.number}차시 결과물: ${featured.title}` : `${lesson.number}차시 ${lesson.title}`,
    index: course.visibility === 'public',
  });
}

// 차시 페이지 (HOME-03): 실습 안내 → 내 결과물 올리기 → 다른 결과물 → 이전·다음 차시. 모바일 우선.
export default async function LessonPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { course, lessons, lesson, prev, next, key } = data;
  const query = await props.searchParams;
  const { sort, page } = parseListQuery(query.sort, query.page);
  const client = await createUserClient({ readOnly: true });
  const [{ posts, hasMore }, counts] = await Promise.all([
    listPosts(client, course.slug, key, lesson.number, sort, page).catch(() => ({ posts: [], hasMore: false })),
    lessonPostCounts(client, course.slug, key).catch(() => new Map<number, number>()),
  ]);
  const total = counts.get(lesson.number) ?? posts.length;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const lessonPath = coursePath(course.slug, key, lesson.number);
  const newPostPath = lessonPath.replace(/(\?|$)/, '/new$1');
  const posted = query.posted === '1';
  const deleted = query.deleted === '1';
  const sorts: [PostSort, string][] = [['new', '최신순'], ['popular', '인기순']];

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

      <section className="mt-6">
        {deleted && <p role="status" className="mb-3 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">결과물을 지웠어요. 30일 뒤 완전히 지워져요.</p>}
        {posted && <p role="status" className="mb-3 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">결과물을 올렸어요! 🎉</p>}
        <Link href={newPostPath} className="block w-full rounded-2xl bg-ink px-6 py-4 text-center text-base font-semibold text-white transition-colors hover:bg-mocha-deep">
          내 결과물 올리기
        </Link>
        <p className="mt-2 text-center text-xs text-mute">로그인하면 이미지·링크·글로 올릴 수 있어요.</p>
      </section>

      {/* GAL-02 카드 목록: 최신순/인기순 + 더 보기. 정렬·쪽은 주소에 담는다. 상세는 GAL-상세에서 */}
      <section id="posts" className="mt-10 scroll-mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">결과물 {total > 0 ? total : ''}</h2>
          {total > 0 && (
            <div role="tablist" aria-label="정렬" className="flex rounded-full border border-line p-0.5 text-sm">
              {sorts.map(([value, label]) => (
                <Link key={value} role="tab" aria-selected={sort === value} scroll={false} replace
                  href={postListPath(lessonPath, value)}
                  className={`rounded-full px-3 py-1 ${sort === value ? 'bg-ink text-white' : 'text-mute hover:text-mocha'}`}>
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {posts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">아직 올라온 결과물이 없어요. 첫 번째로 올려 보세요!</p>
        ) : (
          <>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.map((p) => (
                <li key={p.id}>
                  {/* 카드 전체가 상세로 가는 링크. 바깥 링크는 상세에서 연다(링크 안에 링크를 둘 수 없다) */}
                  <Link href={postPath(lessonPath, p.id)} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper hover:border-mocha">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소
                    <img src={galleryImageUrl(supabaseUrl, p.images[0])} alt="" loading="lazy" className="aspect-[4/3] w-full bg-cream object-cover" />
                  ) : p.links[0] ? (
                    <span className="grid aspect-[4/3] place-items-center bg-cream px-3 text-center text-xs text-mocha-deep">
                      <span className="min-w-0 break-all">🔗<br />{linkLabel(p.links[0])}</span>
                    </span>
                  ) : (
                    // 글만 올린 결과물: 소개 앞부분을 카드 머리에 보여 준다
                    <span className="line-clamp-5 block aspect-[4/3] overflow-hidden whitespace-pre-line break-words bg-cream px-3 py-3 text-xs leading-relaxed text-ink-soft">{p.body}</span>
                  )}
                  <span className="mt-auto block px-3 py-2.5">
                    <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-mute">
                      {p.author}{p.images.length > 1 && ` · 사진 ${p.images.length}장`}{p.images.length > 0 && p.links.length > 0 && ` · 링크 ${p.links.length}`}{p.status === 'hidden' && ' · 숨김(신고)'}
                    </span>
                    <span className="mt-1 block text-xs text-mute">
                      <span aria-label={`좋아요 ${p.like_count}개${p.liked ? ", 내가 누름" : ""}`} className={p.liked ? "text-mocha-deep" : undefined}>{p.liked ? "♥" : "♡"} {p.like_count}</span>
                      <span className="ml-2" aria-label={`댓글 ${p.comment_count}개`}>💬 {p.comment_count}</span>
                    </span>
                  </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hasMore && page < MAX_PAGE && (
              <Link href={postListPath(lessonPath, sort, page + 1)} scroll={false} replace
                className="mt-5 block rounded-2xl border border-line-strong px-6 py-3 text-center text-sm font-medium text-ink hover:border-mocha hover:text-mocha">
                더 보기
              </Link>
            )}
            {sort === 'popular' && <p className="mt-3 text-center text-xs text-mute">좋아요가 같으면 최근에 올린 것부터 보여요.</p>}
          </>
        )}
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
