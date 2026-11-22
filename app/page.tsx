import Link from 'next/link';
import HomeEntry from '@/components/home/HomeEntry';
import { CHANNELS, coursePath } from '@/lib/course/model';
import { galleryImageUrl, postPath } from '@/lib/gallery/model';
import { homeFeed } from '@/lib/home/store';
import { plainSummary } from '@/lib/share/meta';

// 공개 강의·결과물이 바뀌면 바로 보이게 매번 새로 읽는다.
export const dynamic = 'force-dynamic';

// 메인(HOME-01): 위쪽은 원래 첫 화면(강사 수업 열기 · 학생 참여 코드 입장) 그대로,
// 아래에 공개 강의 카드와 최근 결과물을 붙인다. 공개 강의만 — 링크 공개·준비 중은 나오지 않는다.
export default async function Home() {
  const { courses, posts } = await homeFeed();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <main className="pb-20">
      <HomeEntry />

      <section aria-labelledby="home-courses" className="mx-auto mt-20 w-full max-w-5xl px-6">
        <p className="eyebrow">COURSES</p>
        <h2 id="home-courses" className="mt-2 text-2xl font-bold text-ink">공개 강의</h2>
        <p className="mt-1 text-sm text-ink-soft">차시마다 실습 안내를 보고, 내 결과물을 올리고, 다른 사람 결과물을 구경해요.</p>
        {courses.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-mute">
            공개 강의를 준비하고 있어요. 영상이나 수업에서 받은 링크·QR로 들어오면 바로 볼 수 있어요.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.slug}>
                <Link href={coursePath(c.slug, null)} className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-colors hover:border-mocha">
                  {c.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 강사가 넣은 외부 주소라 next/image 도메인 설정을 쓰지 않는다
                    <img src={c.cover_url} alt="" className="aspect-video w-full bg-cream object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex aspect-video w-full items-center justify-center bg-gardenia text-3xl font-bold text-mocha">
                      {c.title.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs text-mute">{CHANNELS[c.channel] ?? ''}</p>
                    <h3 className="mt-1 font-semibold text-ink">{c.title}</h3>
                    {c.description && <p className="mt-1 line-clamp-2 flex-1 text-sm text-ink-soft">{plainSummary(c.description, 90)}</p>}
                    <p className="mt-3 text-xs text-ink-soft">차시 {c.lesson_count}개 · 결과물 {c.post_count}개</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {posts.length > 0 && (
        <section aria-labelledby="home-posts" className="mx-auto mt-16 w-full max-w-5xl px-6">
          <p className="eyebrow">GALLERY</p>
          <h2 id="home-posts" className="mt-2 text-2xl font-bold text-ink">최근 결과물</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={postPath(coursePath(p.course_slug, null, p.lesson_number), p.id)}
                  className="block h-full overflow-hidden rounded-xl border border-line bg-paper transition-colors hover:border-mocha">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소
                    <img src={galleryImageUrl(supabaseUrl, p.image)} alt="" loading="lazy" className="aspect-[4/3] w-full bg-cream object-cover" />
                  ) : (
                    <div aria-hidden="true" className="flex aspect-[4/3] w-full items-center justify-center bg-cream text-xs text-mute">
                      {p.has_link ? '🔗 링크' : '글'}
                    </div>
                  )}
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium text-ink">{p.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-mute">{p.author} · {p.course_title} {p.lesson_number}차시</p>
                    {p.like_count > 0 && <p className="mt-0.5 text-xs text-mocha-deep">♥ {p.like_count}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
