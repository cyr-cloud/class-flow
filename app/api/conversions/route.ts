import { head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { z } from "zod";
import { ConversionQueue, conversionEnabled, INPUT_LIMIT, publicJob } from "@/lib/conversion/queue";
import { readSession, isTeacher } from "@/lib/live/server";
import networking from "@/public/events/networking-20260923.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Prepare = z.object({ action: z.literal("prepare"), name: z.string().min(1).max(200).regex(/\.pptx$/i), key: z.string().regex(/^[a-f0-9]{64}$/), iv: z.string().regex(/^[a-f0-9]{24}$/), inputBytes: z.number().int().min(17).max(INPUT_LIMIT) });
const Submit = z.object({ action: z.enum(["submit", "cancel"]), id: z.string().uuid() });

export async function POST(request: Request) {
  if (!conversionEnabled()) return Response.json({ error: "서버 PPT 변환을 준비 중이에요. PDF를 올려 주세요." }, { status: 503 });
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const state = await readSession(sessionId, true);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 4096) throw new Error("요청이 너무 큽니다.");
    const body = z.union([Prepare, Submit]).parse(JSON.parse(text));
    const queue = new ConversionQueue();
    if (body.action === "prepare") {
      const job = await queue.prepare(sessionId, body.name, body.key, body.iv, body.inputBytes);
      const token = await generateClientTokenFromReadWriteToken({ pathname: job.sourcePath, allowedContentTypes: ["application/octet-stream"], maximumSizeInBytes: job.inputBytes, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 15 * 60_000 });
      return Response.json({ id: job.id, pathname: job.sourcePath, token }, { headers: { "Cache-Control": "no-store" } });
    }
    const job = await queue.get(body.id);
    if (!job || job.sessionId !== sessionId) return Response.json({ error: "작업을 찾지 못했어요." }, { status: 404 });
    if (body.action === "cancel") { await queue.cancelUpload(job.id); return Response.json({ ok: true }); }
    const source = await head(job.sourcePath);
    if (source.size !== job.inputBytes || source.contentType !== "application/octet-stream") throw new Error("업로드 파일을 확인해 주세요.");
    return Response.json(publicJob(await queue.enqueue(job.id, source.url)));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "변환 요청 실패" }, { status: 400 }); }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("sessionId") ?? "";
  const state = await readSession(sessionId, true);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  const queue = new ConversionQueue();
  // The event preset reuses one converted PPT. Only an authenticated owner of a
  // lesson using that exact preset PDF can retrieve its original and notes.
  const materialSession = params.get("material") === "1" && state.session.pdfKey === networking.pdfKey
    ? networking.sourceSession : sessionId;
  const job = params.get("material") === "1" ? await queue.material(materialSession, state.session.pdfKey ?? "") : await queue.get(params.get("id") ?? "");
  if (!job || job.sessionId !== materialSession) return Response.json({ error: "자료를 찾지 못했어요." }, { status: 404 });
  // Only the authenticated teacher can decrypt/download the original PPT and its notes.
  const result = params.get("material") === "1" ? { ...publicJob(job), sourceUrl: job.sourceUrl, key: job.key, iv: job.iv } : publicJob(job);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
