import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cleanAccessKey, coursePath, SHORT_CODE_PATTERN } from '@/lib/course/model';
import { detectSource, isBotAgent } from '@/lib/share/source';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ key?: string | string[]; from?: string | string[] }> };

// 차시 짧은 링크 (SHARE-01): /p/py03 → /courses/[강의]/[차시]. 영상 설명란·QR에 넣는 주소.
// 볼 수 있는 강의일 때만 찾아 준다(DB resolve_short_code). 못 찾으면 404 — 코드가 있는지 없는지 구분해 알려 주지 않는다.
// 유입 경로(SHARE-04): ?from=yt|inf|qr 또는 이전 페이지 주소로 출처를 정해 한 번 센다. 미리보기 로봇은 세지 않는다.
export default async function ShortLinkPage({ params, searchParams }: Props) {
  const code = (await params).code.toLowerCase();
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const query = await searchParams;
  const key = cleanAccessKey(query.key);
  const client = await createUserClient({ readOnly: true });
  const { data } = await client.rpc('resolve_short_code', { p_code: code, p_key: key });
  const hit = (data as { slug: string; lesson_number: number }[] | null)?.[0];
  if (!hit) notFound();
  const h = await headers();
  if (!isBotAgent(h.get('user-agent')) && h.get('purpose') !== 'prefetch') {
    // 세기 실패는 이동을 막지 않는다.
    await client.rpc('record_link_visit', { p_code: code, p_key: key, p_source: detectSource(query.from, h.get('referer')) }).then(() => null, () => null);
  }
  redirect(coursePath(hit.slug, key, hit.lesson_number));
}
