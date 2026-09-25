import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isTeacher, readSession } from "@/lib/live/server";
import { localMaterialEnabled, readLocalMaterial, saveLocalMaterial } from "@/lib/localMaterial";
import { PDF_UPLOAD_MAX_BYTES, PDF_UPLOAD_SIZE_ERROR } from "@/lib/lecture/uploadLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Notes = z.array(z.object({ slideNo: z.number().int().positive(), text: z.string().max(100000) })).max(1000);

export async function POST(request: Request) {
  if (!localMaterialEnabled()) return Response.json({ error: "로컬 전용 기능입니다." }, { status: 404 });
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const state = await readSession(sessionId);
    if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
    const form = await request.formData();
    const pdf = form.get("pdf");
    if (!(pdf instanceof File) || !pdf.size || pdf.size > PDF_UPLOAD_MAX_BYTES) throw new Error(PDF_UPLOAD_SIZE_ERROR);
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("올바른 PDF가 아닙니다.");
    const raw = form.get("notes") ?? "[]";
    if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 2 * 1024 * 1024) throw new Error("발표자 노트가 너무 큽니다.");
    const notes = Notes.parse(JSON.parse(raw));
    const id = randomUUID();
    const original = form.get("original");
    if (original && (!(original instanceof File) || !/\.pptx$/i.test(original.name) || original.size > 200 * 1024 * 1024 || !original.size)) throw new Error("200MB 이하 PPTX 원본을 선택해 주세요.");
    await saveLocalMaterial(id, bytes, notes, original instanceof File ? new Uint8Array(await original.arrayBuffer()) : undefined);
    return Response.json({ url: `/api/local-material/${id}`, noteCount: notes.length });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "자료를 저장하지 못했어요." }, { status: 400 }); }
}

export async function GET(request: Request) {
  if (!localMaterialEnabled()) return Response.json({ error: "로컬 전용 기능입니다." }, { status: 404 });
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  // 다른 Route Handler의 폴링 캐시는 자료 교체 직전 값을 가지고 있을 수 있다.
  // 업로드 직후 대본/원본을 읽을 때는 저장소의 최신 자료 ID를 사용한다.
  const state = await readSession(sessionId, true);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  const id = state.session.pdfKey?.match(/^\/api\/local-material\/([a-f0-9-]{36})$/)?.[1];
  if (!id) return Response.json({ notes: [] });
  if (new URL(request.url).searchParams.get("download") === "pptx") {
    try {
      const bytes = await readLocalMaterial(id, "pptx");
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": "attachment; filename=lesson.pptx", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    } catch { return Response.json({ error: "보관된 PPTX 원본이 없어요. PPTX를 다시 업로드해 주세요." }, { status: 404 }); }
  }
  try { return Response.json({ notes: JSON.parse((await readLocalMaterial(id, "json")).toString()) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "발표자 노트를 불러오지 못했어요." }, { status: 404 }); }
}
