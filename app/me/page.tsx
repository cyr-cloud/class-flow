import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import LogoutButton from './LogoutButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '마이페이지 — ClassFlow', robots: { index: false } };

// AUTH-01 확인용 최소 마이페이지. 닉네임·내 결과물은 AUTH-03 / GAL 작업에서 채운다.
export default async function MePage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/me');
  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <p className="eyebrow">MY PAGE</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">로그인되어 있어요</h1>
      <p className="mt-4 text-sm text-ink-soft">
        계정 <span className="font-mono text-ink">{user.email}</span>
      </p>
      <p className="mt-2 text-xs text-mute">내가 올린 결과물과 닉네임 설정은 곧 이곳에 생겨요.</p>
      <div className="mt-8"><LogoutButton /></div>
    </main>
  );
}
