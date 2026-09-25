import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isTeacher, readSession, validId } from "@/lib/live/server";
import { PDF_UPLOAD_MAX_BYTES } from "@/lib/lecture/uploadLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PDF bytes go directly to Blob; only the small authorization request passes through Vercel.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "공유 PDF 저장소가 설정되지 않았어요. BLOB_READ_WRITE_TOKEN을 연결해 주세요." }, { status: 503 });
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({ request, body,
      onBeforeGenerateToken: async (pathname, payload) => {
        const { sessionId } = JSON.parse(payload ?? "{}") as { sessionId?: string };
        if (!sessionId || !validId(sessionId)) throw new Error("수업 코드를 확인해 주세요.");
        const session = await readSession(sessionId);
        if (!session || !isTeacher(session, request.headers.get("x-teacher-token") ?? "")) throw new Error("이 수업을 연 강사만 PDF를 올릴 수 있어요.");
        if (!pathname.startsWith(`decks/${sessionId}/`) || !/^decks\/[\w-]+\/[a-f0-9-]+\.pdf$/.test(pathname)) throw new Error("잘못된 파일 경로입니다.");
        return { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: PDF_UPLOAD_MAX_BYTES, addRandomSuffix: true, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "업로드를 준비하지 못했어요." }, { status: 400 });
  }
}
