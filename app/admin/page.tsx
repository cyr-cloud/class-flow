import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/admin';

const SECTIONS = [
  { id: 'COURSE', title: '강의 · 차시', body: '강의 만들기, 차시 추가·순서 변경, 실습 안내 작성', href: '/admin/courses' },
  { id: 'ADM-02', title: '신고 처리', body: '갤러리 결과물 숨김·복구·삭제, 업로드 정지' },
  { id: 'ADM-03', title: '현황', body: '차시별 결과물 수, 새 가입자, 유입 경로' },
];

// 관리자 첫 화면. 실제 기능은 갤러리(GAL)가 생긴 뒤 ADM-02·03에서 채운다.
// 레이아웃은 화면 이동 때 다시 실행되지 않을 수 있어서, /admin 아래 모든 page도 각자 권한을 확인한다.
export default async function AdminHome() {
  const { access, nickname } = await requireAdminPage();
  if (access !== 'admin') return null;
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="eyebrow">ADMIN</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">관리자</h1>
      <p className="mt-2 text-sm text-ink-soft">{nickname ?? '관리자'}님으로 들어왔어요.</p>
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
                <p className="mt-4 text-xs text-mute">갤러리 기능이 생기면 열려요</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
