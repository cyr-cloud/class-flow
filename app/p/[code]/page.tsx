import { notFound, redirect } from 'next/navigation';
import { cleanAccessKey, coursePath, SHORT_CODE_PATTERN } from '@/lib/course/model';
import { createUserClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ key?: string | string[] }> };

// 차시 짧은 링크 (SHARE-01): /p/py03 → /courses/[강의]/[차시]. 영상 설명란·QR에 넣는 주소.
// 볼 수 있는 강의일 때만 찾아 준다(DB resolve_short_code). 못 찾으면 404 — 코드가 있는지 없는지 구분해 알려 주지 않는다.
export default async function ShortLinkPage({ params, searchParams }: Props) {
  const code = (await params).code.toLowerCase();
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const key = cleanAccessKey((await searchParams).key);
  const client = await createUserClient({ readOnly: true });
  const { data } = await client.rpc('resolve_short_code', { p_code: code, p_key: key });
  const hit = (data as { slug: string; lesson_number: number }[] | null)?.[0];
  if (!hit) notFound();
  redirect(coursePath(hit.slug, key, hit.lesson_number));
}
