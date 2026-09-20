import { execute, isTeacher, publicState, readSession, validId } from "@/lib/live/server";
import type { LiveCommand } from "@/lib/live/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ sessionId: string }> };
export async function GET(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const state = await readSession(sessionId);
  if (!state) return Response.json({ error: "강사님이 수업을 준비 중이에요. 코드를 확인해 주세요." }, { status: 404 });
  return Response.json(publicState(state, isTeacher(state, request.headers.get("x-teacher-token") ?? "")),
    { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;
  if (!validId(sessionId)) return Response.json({ error: "잘못된 세션 코드입니다." }, { status: 400 });
  try {
    const command = await request.json() as LiveCommand;
    return Response.json(await execute(sessionId, request.headers.get("x-teacher-token") ?? "", command));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했어요." }, { status: 400 });
  }
}
