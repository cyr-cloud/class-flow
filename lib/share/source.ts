// 유입 경로(SHARE-04). 짧은 링크 뒤에 ?from=yt 처럼 붙여서 어디서 들어왔는지 센다.
// 사람 정보는 남기지 않는다. 출처 이름만 DB(record_link_visit)에 보낸다.

export const LINK_SOURCES = {
  youtube: { label: '유튜브', param: 'yt', hint: '영상 설명란·고정 댓글' },
  inflearn: { label: '인프런', param: 'inf', hint: '강의 자료·수업 노트' },
  qr: { label: 'QR', param: 'qr', hint: '수업 화면·인쇄물' },
  other: { label: '기타', param: '', hint: '출처 표시 없이 들어온 것' },
} as const;
export type LinkSource = keyof typeof LINK_SOURCES;
export const SOURCE_ORDER: LinkSource[] = ['youtube', 'inflearn', 'qr', 'other'];

const BY_PARAM: Record<string, LinkSource> = { yt: 'youtube', youtube: 'youtube', inf: 'inflearn', inflearn: 'inflearn', qr: 'qr' };

// ?from= 값이 먼저. 없으면 이전 페이지 주소(Referer)로 짐작한다. 둘 다 모르면 기타.
export function detectSource(from: unknown, referer: string | null | undefined): LinkSource {
  const raw = Array.isArray(from) ? from[0] : from;
  if (typeof raw === 'string') {
    const hit = BY_PARAM[raw.trim().toLowerCase()];
    if (hit) return hit;
  }
  if (referer) {
    try {
      const host = new URL(referer).hostname.toLowerCase();
      if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
      if (host === 'inflearn.com' || host.endsWith('.inflearn.com')) return 'inflearn';
    } catch {
      // 이상한 Referer는 무시
    }
  }
  return 'other';
}

// 미리보기를 만들러 오는 로봇(카카오톡·SNS·검색)은 세지 않는다.
const BOT = /bot|crawl|spider|slurp|preview|scrap|facebookexternalhit|kakaotalk-scrap|embedly|whatsapp|telegram|discord|curl|wget|python-requests|headless/i;
export function isBotAgent(ua: string | null | undefined): boolean {
  return !ua || BOT.test(ua);
}
