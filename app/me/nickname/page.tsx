import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeReturnPath } from '@/lib/auth/input';
import { suggestNickname } from '@/lib/profile/nickname';
import { signupState } from '@/lib/profile/setup';
import { createUserClient, currentUser } from '@/lib/supabase/server';
import NicknameForm from './NicknameForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '닉네임 — ClassFlow', robots: { index: false } };

// 첫 로그인 때 한 번 거치는 닉네임 화면. 마이페이지에서 다시 들어와 바꿀 수도 있다.
export default async function NicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeReturnPath(rawNext);
  const user = await currentUser();
  if (!user) redirect('/login?next=' + encodeURIComponent('/me/nickname'));
  const state = await signupState(await createUserClient({ readOnly: true }), user.id);
  const current = state.nickname;
  const first = current === null;
  const needConsent = !state.consented; // 지금 판 약관·처리방침·만 14세 확인이 없으면 같이 받는다
  const initial = current ?? suggestNickname(user.user_metadata);

  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <p className="eyebrow">{first ? 'WELCOME' : 'MY PAGE'}</p>
      <h1 className="mt-3 text-2xl font-bold text-ink">{first ? '닉네임을 정해주세요' : needConsent ? '약관 동의가 필요해요' : '닉네임 바꾸기'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        갤러리에 올린 결과물과 채팅에 이 이름으로 보여요. <b className="text-ink">실명이 아니어도 괜찮아요.</b>
        {first && ' 나중에 마이페이지에서 바꿀 수 있어요.'}
      </p>
      {!first && needConsent && (
        <p className="mt-3 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">결과물·댓글을 올리려면 아래 내용을 확인하고 동의해 주세요. 한 번만 하면 돼요.</p>
      )}
      <NicknameForm initial={initial} next={next} first={first} needConsent={needConsent} />
    </main>
  );
}
