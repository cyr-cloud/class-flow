import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';
import { courseShareUrl, shortLinkUrl, VISIBILITIES } from '@/lib/course/model';
import { listCourses, listLessons } from '@/lib/course/store';
import { isPostId } from '@/lib/gallery/model';
import { LINK_SOURCES } from '@/lib/share/source';
import { createUserClient } from '@/lib/supabase/server';
import { FillCodes, ShareQr } from './ui';

export const dynamic = 'force-dynamic';

// 짧은 코드 앞글자 추천: 강의 주소의 각 단어 첫 글자(dopamine-python → dp), 한 단어면 앞 4글자
function suggestPrefix(slug: string): string {
  const words = slug.split('-').map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean);
  const initials = words.map((w) => w[0]).join('');
  return (initials.length >= 2 ? initials : (words[0] ?? 'cf').slice(0, 4)).slice(0, 12) || 'cf';
}

// 공유 (SHARE-01·02): 강의를 고르면 강의 링크와 차시별 짧은 링크·QR PNG를 내려받는다. 영상 설명란·인프런 자료·수업 화면에 넣는 용도.
export default async function AdminSharePage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { access } = await requireAdminPage('/admin/share');
  if (access !== 'admin') return null;
  const client = await createUserClient({ readOnly: true });
  const courses = await listCourses(client);
  const wanted = (await searchParams).course;
  const course = courses.find((c) => c.id === (wanted && isPostId(wanted) ? wanted : '')) ?? courses[0];
  const lessons = course ? await listLessons(client, course.id) : [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const devSite = /localhost|127\.0\.0\.1/.test(siteUrl);
  const courseUrl = course ? courseShareUrl(siteUrl, course) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin" className="text-sm text-mute hover:text-mocha">← 관리자</Link>
      <p className="eyebrow mt-4">SHARE-01 · 02</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">링크 · QR 공유</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">차시마다 짧은 주소(<span className="font-mono">/p/코드</span>)와 QR 이미지를 내려받아 영상 설명란·인프런 자료·수업 화면에 넣어요. 유튜브·인프런에는 각각의 <b className="text-ink">…용 복사</b> 주소를 넣으면 <Link href="/admin/stats" className="text-mocha underline">현황</Link>에서 어디서 들어왔는지 나눠 볼 수 있어요.</p>
      {devSite && (
        <p role="note" className="mt-4 rounded-xl border border-mocha bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">
          지금 주소가 개발용(<span className="font-mono">{siteUrl}</span>)이에요. 배포해서 <span className="font-mono">class.yuniq-coding.shop</span>이 연결된 뒤에 다시 내려받아야 학생이 열 수 있어요.
        </p>
      )}

      {courses.length === 0 ? (
        <p className="mt-8 text-sm text-mute">강의가 없어요. <Link href="/admin/courses" className="text-mocha underline">강의 만들기</Link></p>
      ) : (
        <>
          <nav aria-label="강의 고르기" className="mt-8 flex flex-wrap gap-2">
            {courses.map((c) => (
              <Link key={c.id} href={`/admin/share?course=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm ${c.id === course?.id ? 'border-ink bg-ink text-white' : 'border-line-strong text-ink-soft hover:border-mocha'}`}>
                {c.title}
              </Link>
            ))}
          </nav>

          {course && (
            <section className="mt-8" aria-labelledby="course-share">
              <h2 id="course-share" className="font-semibold text-ink">{course.title}</h2>
              <p className="mt-1 text-xs text-mute">공개 범위: {VISIBILITIES[course.visibility]}{course.visibility === 'unlisted' && ' — 링크·QR에 열쇠가 들어가요. 열쇠를 바꾸면 다시 내려받아야 해요.'}</p>

              {course.visibility === 'draft' && (
                <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-mute">
                  준비 중인 강의라 학생은 열 수 없어서 QR은 만들지 않아요. 짧은 코드는 미리 만들어 둘 수 있어요. <Link href={`/admin/courses/${course.id}`} className="text-mocha underline">강의 설정</Link>에서 공개 또는 링크 공개로 바꾸면 QR이 생겨요.
                </p>
              )}
              {(
                <>
                  {courseUrl && (
                    <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-4">
                      <p className="mb-3 text-sm font-medium text-ink">강의 소개 페이지</p>
                      <ShareQr url={courseUrl} fileName={`ClassFlow-${course.slug}-강의-QR.png`} label={`${course.title} 강의`} />
                    </div>
                  )}
                  <div className="mt-6"><FillCodes courseId={course.id} suggestion={suggestPrefix(course.slug)} /></div>
                  <ul className="mt-4 grid gap-3">
                    {lessons.map((l) => {
                      // QR에 넣는 주소는 ?from=qr, 아래 복사 주소는 유튜브·인프런용(SHARE-04 유입 경로)
                      const url = l.short_code ? shortLinkUrl(siteUrl, l.short_code, course, LINK_SOURCES.qr.param) : null;
                      const sources = l.short_code ? (['youtube', 'inflearn'] as const).map((s) => ({
                        label: LINK_SOURCES[s].label, hint: LINK_SOURCES[s].hint,
                        url: shortLinkUrl(siteUrl, l.short_code!, course, LINK_SOURCES[s].param) ?? '',
                      })) : [];
                      return (
                        <li key={l.id} className="rounded-2xl border border-line bg-paper px-4 py-4">
                          <p className="mb-3 text-sm font-medium text-ink">{l.number}차시 · {l.title}</p>
                          {url ? (
                            <ShareQr url={url} fileName={`ClassFlow-${l.short_code}-QR.png`} label={`${l.number}차시`} sources={sources} />
                          ) : l.short_code ? (
                            <p className="font-mono text-xs text-ink-soft">/p/{l.short_code} <span className="font-sans text-mute">(공개하면 QR이 생겨요 · 관리자는 지금도 열 수 있어요)</span></p>
                          ) : (
                            <p className="text-xs text-mute">짧은 코드가 없어요. 위에서 한 번에 만들거나 <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="text-mocha underline">차시 편집</Link>에서 정해 주세요.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
