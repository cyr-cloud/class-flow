import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';
import { coursePath } from '@/lib/course/model';
import { postPath, REPORT_HIDE_AT, reportReasonLabel } from '@/lib/gallery/model';
import { adminReportAlerts } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';

const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const SECTIONS = [
  { id: 'COURSE', title: '강의 · 차시', body: '강의 만들기, 차시 추가·순서 변경, 실습 안내 작성', href: '/admin/courses' },
  { id: 'ADM-02', title: '신고 처리', body: '갤러리 결과물 숨김·복구·삭제, 업로드 정지 (신고 알림은 위에 먼저 보여요)' },
  { id: 'ADM-03', title: '현황', body: '차시별 결과물 수, 새 가입자, 유입 경로' },
];

// 관리자 첫 화면. 실제 기능은 갤러리(GAL)가 생긴 뒤 ADM-02·03에서 채운다.
// 레이아웃은 화면 이동 때 다시 실행되지 않을 수 있어서, /admin 아래 모든 page도 각자 권한을 확인한다.
export default async function AdminHome() {
  const { access, nickname } = await requireAdminPage();
  if (access !== 'admin') return null;
  const alerts = await adminReportAlerts(await createUserClient({ readOnly: true })).catch(() => []);
  const hidden = alerts.filter((a) => a.status === 'hidden').length;
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="eyebrow">ADMIN</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">관리자</h1>
      <p className="mt-2 text-sm text-ink-soft">{nickname ?? '관리자'}님으로 들어왔어요.</p>

      {/* GAL-06 관리자 알림: 처리 안 한 신고. 자동 숨김(서로 다른 3명)이 먼저. 처리 버튼은 ADM-02에서 */}
      <section aria-labelledby="report-alerts" className={`mt-8 rounded-2xl border px-5 py-5 ${hidden > 0 ? 'border-mocha bg-mocha-tint' : 'border-line bg-paper'}`}>
        <h2 id="report-alerts" className="font-semibold text-ink">
          {alerts.length === 0 ? '새 신고가 없어요' : `🚩 처리 안 한 신고 ${alerts.length}건`}
          {hidden > 0 && <span className="ml-2 text-sm font-normal text-mocha-deep">· 자동으로 숨겨진 것 {hidden}건</span>}
        </h2>
        {alerts.length > 0 && (
          <ul className="mt-4 grid gap-3">
            {alerts.map((a) => {
              const link = postPath(coursePath(a.course_slug, null, a.lesson_number), a.post_id);
              return (
                <li key={a.target + a.target_id} className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${a.status === 'hidden' ? 'bg-mocha text-white' : 'bg-cream text-ink-soft'}`}>
                      {a.status === 'hidden' ? '자동 숨김' : `신고 ${a.report_count}/${REPORT_HIDE_AT}`}
                    </span>
                    <span>{a.target === 'post' ? '결과물' : '댓글'}</span>
                    <span>· {a.reasons.map(reportReasonLabel).join(', ')}</span>
                    <span className="ml-auto">{timeFormat.format(new Date(a.last_reported_at))}</span>
                  </p>
                  <p className="mt-1.5 font-medium text-ink break-words">{a.target === 'comment' ? `“${a.excerpt}”` : a.title}</p>
                  <p className="mt-0.5 text-xs text-mute break-words">
                    {a.author} · {a.course_title} {a.lesson_number}차시{a.target === 'comment' && ` · 「${a.title}」의 댓글`}
                  </p>
                  {a.target === 'post' && a.excerpt && <p className="mt-1 line-clamp-2 text-xs text-ink-soft break-words">{a.excerpt}</p>}
                  {a.status === 'visible' || a.target === 'comment' ? (
                    <Link href={link} className="mt-2 inline-block text-xs text-mocha hover:underline">결과물 열어 보기 →</Link>
                  ) : (
                    <p className="mt-2 text-xs text-mute">숨겨진 결과물은 ADM-02 신고 처리 화면에서 보고 복구·삭제할 수 있게 돼요.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            {'href' in s && s.href ? (
              <Link href={s.href} className="block h-full rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-mocha">
                <p className="eyebrow">{s.id}</p>
                <h2 className="mt-2 font-semibold text-ink">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
                <p className="mt-4 text-xs text-mocha">열기 →</p>
              </Link>
            ) : (
              <div className="h-full rounded-2xl border border-line bg-paper p-5">
                <p className="eyebrow">{s.id}</p>
                <h2 className="mt-2 font-semibold text-ink">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
                <p className="mt-4 text-xs text-mute">곧 열려요</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
