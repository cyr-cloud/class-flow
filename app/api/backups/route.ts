import { isTeacher, readSession } from "@/lib/live/server";
import { listBackups, readBackup } from "@/lib/live/backups";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("sessionId") ?? "";
  const state = await readSession(id, true);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? ""))
    return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  const headers = { "Cache-Control": "private, no-store" };
  if (!params.has("revision")) return Response.json({ backups: await listBackups(id) }, { headers });
  const revision = Number(params.get("revision"));
  if (!Number.isSafeInteger(revision) || revision < 0) return Response.json({ error: "잘못된 백업 번호입니다." }, { status: 400 });
  const backup = await readBackup(id, revision);
  return backup ? Response.json(backup, { headers }) : Response.json({ error: "백업을 찾지 못했어요." }, { status: 404 });
}
