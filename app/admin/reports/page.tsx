import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';
import { coursePath } from '@/lib/course/model';
import { galleryImageUrl, linkLabel, postPath, REPORT_HIDE_AT, reportReasonLabel } from '@/lib/gallery/model';
import { adminReportAlerts, adminUploadBans } from '@/lib/gallery/store';
import { createUserClient } from '@/lib/supabase/server';
import { BanControls, ModerationButtons } from './ui';

export const dynamic = 'force-dynamic';

const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// 신고 처리 (ADM-02): 처리 안 한 신고를 보고 숨김·복구·삭제·문제없음, 글쓴이 업로드 정지.
// 숨겨진 결과물도 여기서는 내용(이미지·링크·글)을 그대로 보여 준다.
export default async function AdminReportsPage() {
  const { access } = await requireAdminPage('/admin/reports');
  if (access !== 'admin') return null;
  const client = await createUserClient({ readOnly: true });
  const [alerts, bans] = await Promise.all([adminReportAlerts(client, 100), adminUploadBans(client)]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link href="/admin" className="text-sm text-mute hover:text-mocha">← 관리자</Link>
      <p className="eyebrow mt-4">ADM-02</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">신고 처리</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        서로 다른 {REPORT_HIDE_AT}명이 신고하면 자동으로 숨겨져요. 처리하면 그 신고는 목록에서 빠져요.
      </p>

      <section aria-labelledby="open-reports" className="mt-8">
        <h2 id="open-reports" className="font-semibold text-ink">처리 안 한 신고 {alerts.length}건</h2>
        {alerts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-mute">처리할 신고가 없어요.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {alerts.map((a) => (
              <li key={a.target + a.target_id} className={`rounded-2xl border bg-paper px-5 py-4 text-sm ${a.status === 'hidden' ? 'border-mocha' : 'border-line'}`}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${a.status === 'hidden' ? 'bg-mocha text-white' : 'bg-cream text-ink-soft'}`}>
                    {a.status === 'hidden' ? '숨겨짐' : `신고 ${a.report_count}/${REPORT_HIDE_AT}`}
                  </span>
                  <span>{a.target === 'post' ? '결과물' : '댓글'}</span>
                  <span>· {a.reasons.map(reportReasonLabel).join(', ')}</span>
                  <span className="ml-auto">{timeFormat.format(new Date(a.last_reported_at))}</span>
                </p>

                <p className="mt-2 font-medium text-ink break-words">{a.target === 'comment' ? `“${a.excerpt}”` : a.title}</p>
                <p className="mt-0.5 text-xs text-mute break-words">
                  {a.author} · {a.course_title} {a.lesson_number}차시{a.target === 'comment' && ` · 「${a.title}」의 댓글`}
                </p>
                {a.target === 'post' && a.excerpt && <p className="mt-2 whitespace-pre-line text-sm text-ink-soft break-words">{a.excerpt}</p>}
                {a.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.images.map((path) => (
                      <a key={path} href={galleryImageUrl(supabaseUrl, path)} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소 */}
                        <img src={galleryImageUrl(supabaseUrl, path)} alt="신고된 결과물 이미지" className="h-24 w-24 rounded-lg border border-line object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {a.links.length > 0 && (
                  <ul className="mt-2 grid gap-1 text-xs">
                    {a.links.map((l) => <li key={l} className="truncate text-mocha-deep">🔗 {linkLabel(l)} <span className="text-mute">(열기 전에 주소를 확인하세요)</span></li>)}
                  </ul>
                )}
                {a.details.length > 0 && (
                  <ul className="mt-3 grid gap-1 rounded-lg bg-cream px-3 py-2 text-xs text-ink-soft">
                    {a.details.map((d, i) => <li key={i} className="break-words">신고 내용: {d}</li>)}
                  </ul>
                )}
                {(a.status === 'visible' || a.target === 'comment') && (
                  <Link href={postPath(coursePath(a.course_slug, null, a.lesson_number), a.post_id)} className="mt-2 inline-block text-xs text-mocha hover:underline">
                    학생 화면에서 보기 →
                  </Link>
                )}

                <ModerationButtons target={a.target} targetId={a.target_id} status={a.status} />
                <div className="mt-3 border-t border-line pt-3">
                  <BanControls userId={a.author_id} nickname={a.author} banned={a.author_banned} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bans" className="mt-12">
        <h2 id="bans" className="font-semibold text-ink">업로드 정지된 사용자 {bans.length > 0 ? bans.length : ''}</h2>
        {bans.length === 0 ? (
          <p className="mt-3 text-sm text-mute">정지된 사용자가 없어요.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {bans.map((b) => (
              <li key={b.user_id} className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
                <p className="font-medium text-ink">{b.nickname}</p>
                <p className="mt-0.5 text-xs text-mute">
                  {b.until ? `${timeFormat.format(new Date(b.until))}까지` : '풀 때까지'} · 정지한 때 {timeFormat.format(new Date(b.created_at))}
                  {b.reason && ` · 사유: ${b.reason}`}
                </p>
                <div className="mt-2"><BanControls userId={b.user_id} nickname={b.nickname} banned /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
