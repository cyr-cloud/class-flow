// 실습 결과물 이미지 올리기.
//
// 브라우저에서 이미 줄여서(긴 변 1600px · webp) 보내온 바이트를 공유 저장소에 넣고
// 주소를 돌려준다. 그래야 다른 기기에서도 같은 이미지가 보인다.
// IndexedDB에 두면 올린 사람 브라우저에서만 보여서 실습 갤러리가 성립하지 않는다.

import { kv } from "@/lib/live/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 브라우저에서 줄인 결과가 이보다 크면 받지 않는다 (공유 저장소 한 건 한도를 넘지 않게)
const MAX_BYTES = 700 * 1024;
const TYPES: Record<string, string> = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" };

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const ext = Object.keys(TYPES).find((k) => type === TYPES[k]);
  if (!ext) return Response.json({ error: "webp·jpeg·png 이미지만 올릴 수 있어요." }, { status: 400 });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return Response.json({ error: "빈 파일이에요." }, { status: 400 });
  if (bytes.byteLength > MAX_BYTES)
    return Response.json({ error: "이미지가 너무 커요. 조금 더 작은 화면으로 캡처해 주세요." }, { status: 413 });

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const body = `${ext}:${Buffer.from(bytes).toString("base64")}`;
  if (!(await kv().compareAndSet(`img:${id}`, null, body)))
    return Response.json({ error: "이미지를 저장하지 못했어요. 다시 시도해 주세요." }, { status: 500 });

  return Response.json({ url: `/api/image/${id}` });
}
