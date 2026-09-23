import { timingSafeEqual } from "node:crypto";
import { head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { ConversionQueue, conversionEnabled, OUTPUT_LIMIT } from "@/lib/conversion/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.CONVERSION_WORKER_SECRET ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!conversionEnabled()) return Response.json({ error: "Disabled" }, { status: 503 });
  try {
    const text = await request.text();
    if (text.length > 4096) throw new Error("Request too large");
    const body = JSON.parse(text);
    const queue = new ConversionQueue();
    if (body.action === "claim") {
      const job = await queue.claim();
      if (!job) return Response.json({ job: null });
      const uploadToken = await generateClientTokenFromReadWriteToken({ pathname: job.pdfPath, allowedContentTypes: ["application/pdf"], maximumSizeInBytes: OUTPUT_LIMIT, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 10 * 60_000 });
      return Response.json({ job: { id: job.id, lease: job.lease, sourceUrl: job.sourceUrl, key: job.key, iv: job.iv, pdfPath: job.pdfPath, uploadToken } }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action !== "complete" || typeof body.id !== "string" || typeof body.lease !== "string") throw new Error("Invalid action");
    const job = await queue.get(body.id);
    if (!job || job.lease !== body.lease) throw new Error("Invalid lease");
    if (body.failed === true) await queue.complete(job.id, body.lease, { error: "PPT 변환에 실패했어요. 파일을 확인하거나 PDF로 저장해 올려 주세요." });
    else {
      const output = await head(job.pdfPath);
      if (output.size < 5 || output.size > OUTPUT_LIMIT || output.contentType !== "application/pdf") throw new Error("Invalid output");
      await queue.complete(job.id, body.lease, { pdfUrl: output.url });
    }
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Worker request failed" }, { status: 400 }); }
}
