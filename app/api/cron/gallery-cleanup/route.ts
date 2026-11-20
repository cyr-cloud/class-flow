import { NextResponse } from 'next/server';
import { runGalleryCleanup } from '@/lib/gallery/cleanup';
import { cronAuthorized } from '@/lib/gallery/cron';

export const dynamic = 'force-dynamic';

// Vercel Cron이 하루 한 번 부른다(vercel.json). CRON_SECRET이 맞아야만 돈다.
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: '권한이 없어요.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runGalleryCleanup()) });
  } catch (error) {
    console.error('[gallery-cleanup]', error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : '정리 실패' }, { status: 500 });
  }
}
