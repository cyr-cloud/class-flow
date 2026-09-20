// 강사가 올린 슬라이드 PDF를 공유 저장소에 둔다.
//
// 전에는 올린 PDF를 브라우저(IndexedDB)에 넣었다. 그러면 올린 사람 화면에서만 보이고
// 학생 기기에서는 빈 화면이 된다 — 샘플만 /samples/... 주소라서 예외였다.
// Vercel Blob에 올리고 그 주소를 슬라이드 키로 쓰면 누가 접속하든 같은 화면을 본다.
//
// Upstash Redis에 넣지 않는 이유: 요청 한 건이 1MB로 제한돼 6MB짜리 덱이 안 들어간다.

import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 브라우저에서 이미 PDF로 바뀐 것만 올라온다
const MAX_BYTES = 60 * 1024 * 1024;

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "슬라이드를 저장할 공간이 설정되지 않았어요. (BLOB_READ_WRITE_TOKEN)" },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "파일이 없어요." }, { status: 400 });
    if (file.size === 0) return Response.json({ error: "빈 파일이에요." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return Response.json({ error: "60MB 이하 PDF만 올릴 수 있어요." }, { status: 413 });

    const name = form.get("name");
    const safe = (typeof name === "string" ? name : file.name)
      .replace(/[^\w가-힣.\- ]+/g, "")
      .slice(-80) || "slides.pdf";

    // addRandomSuffix가 주소에 추측 불가능한 문자열을 붙인다 —
    // 공개 저장소지만 수업 링크를 받은 사람만 열 수 있게 하는 장치다.
    const blob = await put(`decks/${safe}`, file, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });

    return Response.json({ url: blob.url });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "슬라이드를 저장하지 못했어요." },
      { status: 500 },
    );
  }
}
