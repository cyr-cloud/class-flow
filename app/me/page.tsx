import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { nicknameSetupPath } from '@/lib/profile/nickname';
import { readNickname } from '@/lib/profile/store';
import { createUserClient, currentUser } from '@/lib/supabase/server';
import LogoutButton from './LogoutButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '마이페이지 — ClassFlow', robots: { index: false } };

// 마이페이지. 내 결과물은 GAL 작업에서 채운다.
const PROVIDER_LABEL: Record<string, string> = { email: '이메일', google: '구글', 'custom:naver': '네이버' };

export default async function MePage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/me');
  const nickname = await readNickname(await createUserClient({ readOnly: true }), user.id);
  // 닉네임 없이 이미 로그인해 있던 사람도 한 번은 정하게 한다(조회 실패 undefined는 넘어간다).
  if (nickname === null) redirect(nicknameSetupPath('/me'));
  const meta = user.user_metadata ?? {};
  const email = user.email || (typeof meta.email === 'string' ? meta.email : '');
  const providers = ((user.app_metadata?.providers as string[] | undefined) ?? [])
    .map((p) => PROVIDER_LABEL[p] ?? p);
  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <p className="eyebrow">MY PAGE</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">{nickname ? `${nickname}님` : '로그인되어 있어요'}</h1>
      <p className="mt-4 text-sm text-ink-soft">
        닉네임 <span className="text-ink">{nickname ?? '불러오지 못했어요'}</span>
        <Link href="/me/nickname" className="ml-3 text-mocha underline-offset-4 hover:underline">바꾸기</Link>
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        계정 <span className="font-mono text-ink">{email || '이메일 없음'}</span>
      </p>
      {providers.length > 0 && (
        <p className="mt-1 text-sm text-ink-soft">로그인 방법 <span className="text-ink">{providers.join(' · ')}</span></p>
      )}
      <p className="mt-2 text-xs text-mute">내가 올린 결과물은 곧 이곳에 생겨요.</p>
      <div className="mt-8"><LogoutButton /></div>
    </main>
  );
}
