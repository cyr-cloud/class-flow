import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import WithdrawForm from './WithdrawForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '탈퇴 — ClassFlow', robots: { index: false } };

// 탈퇴 (LEGAL-07). 무엇이 지워지는지 먼저 보여 주고, 확인 문구를 직접 적게 한다.
export default async function WithdrawPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/me/delete');
  return (
    <main className="mx-auto w-full max-w-md px-6 py-20">
      <Link href="/me" className="text-sm text-mute hover:text-mocha">← 마이페이지</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">탈퇴하기</h1>
      <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-cream px-5 py-4 text-sm leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">탈퇴하면 바로 지워져요. 되돌릴 수 없어요.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>내가 올린 결과물(이미지 파일 포함)과 그 결과물에 달린 댓글·좋아요</li>
          <li>내가 쓴 댓글, 누른 좋아요, 보낸 신고</li>
          <li>닉네임, 약관 동의 기록, 로그인 계정</li>
        </ul>
        <p className="text-xs text-mute">
          유코스토어에서 산 기록이 있으면 법에 따라 구매 기록을 보관해야 해서, 로그인 계정은 남기고 ClassFlow 정보만 지워요.
          계정까지 지우려면 스토어 고객센터로 요청해 주세요.
        </p>
        <p className="text-xs text-mute">같은 구글·네이버 계정으로 다시 로그인하면 새로 가입한 것으로 처리돼요.</p>
      </div>
      <WithdrawForm />
    </main>
  );
}
