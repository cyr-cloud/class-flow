import { authConfig } from '@/lib/auth/config';
import { GALLERY_BUCKET } from '@/lib/gallery/model';
import { deleteMyAccount } from '@/lib/profile/store';
import { checkWithdrawPhrase, WITHDRAW_PHRASE } from '@/lib/profile/withdraw';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// 탈퇴 (LEGAL-07). 1) 내 이미지 파일을 지우고 2) DB 함수 delete_my_account 3) 계정을 지웠으면 로그아웃.
// 이미지 파일이 일부 남아도 결과물 행이 없어져 "안 쓰이는 이미지"가 되므로 매일 정리 작업이 지운다.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  if (!origin || origin !== expected) return Response.json({ message: '사이트에서 다시 시도해주세요.' }, { status: 403 });
  if (!authConfig()) return Response.json({ message: '로그인 서비스를 준비 중입니다.' }, { status: 503 });
  let body: { confirm?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 256) return Response.json({ message: '요청이 너무 큽니다.' }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ message: '입력을 확인해주세요.' }, { status: 400 });
  }
  if (!checkWithdrawPhrase(body?.confirm)) return Response.json({ message: `확인란에 "${WITHDRAW_PHRASE}"를 그대로 적어 주세요.` }, { status: 400 });

  try {
    const client = await createUserClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return Response.json({ message: '로그인이 끝났어요. 다시 로그인해주세요.' }, { status: 401 });
    const folder = data.user.id;
    for (let round = 0; round < 5; round++) {
      const { data: files } = await client.storage.from(GALLERY_BUCKET).list(folder, { limit: 100 });
      if (!files?.length) break;
      await client.storage.from(GALLERY_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
      if (files.length < 100) break;
    }
    const result = await deleteMyAccount(client);
    if (!result) return Response.json({ message: '탈퇴하지 못했어요. 잠시 후 다시 시도하거나 운영자에게 알려 주세요.' }, { status: 503 });
    if (result === 'deleted') await client.auth.signOut({ scope: 'local' }).catch(() => {});
    return Response.json({ result });
  } catch {
    return Response.json({ message: '탈퇴하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
}
