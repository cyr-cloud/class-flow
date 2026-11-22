import Link from 'next/link';
import { barPercent, groupByCourse, sumRecent } from '@/lib/admin/stats';
import { requireAdminPage } from '@/lib/auth/admin';
import { coursePath, VISIBILITIES } from '@/lib/course/model';
import { adminStats } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const dayFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const CHART_DAYS = 14;
const cell = 'px-3 py-2 text-right tabular-nums';

// 현황 (ADM-03): 새 가입자와 차시별 결과물 수. 숫자만 보여 주고 개인 정보는 보여 주지 않는다.
export default async function AdminStatsPage() {
  const { access } = await requireAdminPage('/admin/stats');
  if (access !== 'admin') return null;
  const { lessons, signups, totals } = await adminStats(await createUserClient({ readOnly: true }), 30);
  const courses = groupByCourse(lessons);
  const recent = signups.slice(0, CHART_DAYS);
  const maxDay = Math.max(0, ...recent.map((d) => d.classflow));

  const cards = [
    { label: '오늘 가입', value: sumRecent(signups, 1) },
    { label: '최근 7일 가입', value: sumRecent(signups, 7) },
    { label: '최근 30일 가입', value: sumRecent(signups, 30) },
    { label: '전체 가입자', value: totals?.classflow ?? 0 },
    { label: '결과물 올린 사람', value: totals?.posters ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin" className="text-sm text-mute hover:text-mocha">← 관리자</Link>
      <p className="eyebrow mt-4">ADM-03</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">현황</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        가입자는 <b className="text-ink">약관에 동의하고 가입을 마친 사람</b>을 한국 시간 기준 날짜로 세요. 결과물은 지운 것을 빼고 세요.
      </p>

      <section aria-labelledby="signups" className="mt-8">
        <h2 id="signups" className="font-semibold text-ink">새 가입자</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-line bg-paper px-4 py-3">
              <dt className="text-xs text-mute">{c.label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">{c.value}</dd>
            </div>
          ))}
        </dl>
        {totals && (
          <p className="mt-2 text-xs text-mute">로그인 계정은 유코스토어와 함께 써서 {totals.accounts}개예요. 그중 클래스플로우 가입을 마친 사람만 위에 세요.</p>
        )}

        <h3 className="mt-6 text-sm font-medium text-ink">최근 {CHART_DAYS}일 하루 가입자</h3>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-mute">불러오지 못했어요. 새로 고침해 주세요.</p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {recent.map((d) => (
              <li key={d.day} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-xs">
                <span className="text-mute">{dayFormat.format(new Date(`${d.day}T12:00:00+09:00`))}</span>
                <span className="h-3 rounded-full bg-cream" aria-hidden="true">
                  <span className="block h-3 rounded-full bg-mocha" style={{ width: `${barPercent(d.classflow, maxDay)}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink">{d.classflow}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lessons" className="mt-12">
        <h2 id="lessons" className="font-semibold text-ink">차시별 결과물</h2>
        {courses.length === 0 ? (
          <p className="mt-3 text-sm text-mute">강의가 없어요. <Link href="/admin/courses" className="text-mocha underline">강의 만들기</Link></p>
        ) : (
          courses.map((c) => (
            <div key={c.id} className="mt-5 rounded-2xl border border-line bg-paper">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3">
                <h3 className="font-medium text-ink">{c.title}</h3>
                <span className="text-xs text-mute">{VISIBILITIES[c.visibility]}</span>
                <span className="ml-auto text-xs text-ink-soft">
                  결과물 {c.visible}개{c.hidden > 0 && ` · 숨김 ${c.hidden}`} · 최근 7일 {c.week}개
                  {c.topLesson !== null && ` · 가장 많은 차시 ${c.topLesson}차시`}
                </span>
              </div>
              {c.emptyLessons > 0 && c.emptyLessons < c.lessons.length && (
                <p className="border-b border-line px-4 py-2 text-xs text-mocha-deep">아직 결과물이 없는 차시가 {c.emptyLessons}개 있어요.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-xs text-mute">
                      <th scope="col" className="px-3 py-2 text-left font-normal">차시</th>
                      <th scope="col" className={`${cell} font-normal`}>결과물</th>
                      <th scope="col" className={`${cell} font-normal`}>숨김</th>
                      <th scope="col" className={`${cell} font-normal`}>최근 7일</th>
                      <th scope="col" className={`${cell} font-normal`}>올린 사람</th>
                      <th scope="col" className={`${cell} font-normal`}>마지막</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.lessons.map((l) => (
                      <tr key={l.lesson_id} className="border-t border-line">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <Link href={coursePath(c.slug, null, l.lesson_number)} className="text-ink hover:text-mocha">
                            <span className="text-mute">{l.lesson_number}차시</span> {l.lesson_title}
                          </Link>
                        </th>
                        <td className={`${cell} ${l.visible_posts === 0 ? 'text-mute' : 'font-semibold text-ink'}`}>{l.visible_posts}</td>
                        <td className={`${cell} ${l.hidden_posts > 0 ? 'text-mocha-deep' : 'text-mute'}`}>{l.hidden_posts}</td>
                        <td className={`${cell} text-ink-soft`}>{l.week_posts}</td>
                        <td className={`${cell} text-ink-soft`}>{l.authors}</td>
                        <td className={`${cell} text-xs text-mute`}>{l.last_post_at ? timeFormat.format(new Date(l.last_post_at)) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <p className="mt-10 text-xs text-mute">유입 경로(유튜브·인프런·기타)는 SHARE-04에서 짧은 링크에 출처를 붙인 뒤 여기에 더해요.</p>
    </main>
  );
}
