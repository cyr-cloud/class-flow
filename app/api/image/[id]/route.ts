// 올라온 실습 결과물 이미지 내주기.

import { kv } from "@/lib/live/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-z0-9]{8,64}$/.test(id)) return new Response("잘못된 주소입니다.", { status: 400 });

  const stored = await kv().get(`img:${id}`);
  if (!stored) return new Response("이미지를 찾지 못했습니다.", { status: 404 });

  const at = stored.indexOf(":");
  const type = TYPES[stored.slice(0, at)];
  if (!type) return new Response("이미지를 읽지 못했습니다.", { status: 500 });

  return new Response(Buffer.from(stored.slice(at + 1), "base64"), {
    headers: {
      "Content-Type": type,
      // 한 번 올린 이미지는 바뀌지 않는다 — 주소가 곧 내용이다
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
