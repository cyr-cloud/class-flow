import { timingSafeEqual } from 'node:crypto';

// 정리 작업 주소 보호: Vercel Cron은 "Authorization: Bearer <CRON_SECRET>"을 보낸다. 비밀값이 짧거나 없으면 항상 거절.
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
