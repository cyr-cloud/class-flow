import { readSession, isTeacher } from "@/lib/live/server";
import notes from "@/data/samples/jeonju-day-02-notes.json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  const state = await readSession(sessionId, true);
  if (!state || !isTeacher(state, request.headers.get("x-teacher-token") ?? "")) {
    return Response.json({ error: "강사 권한이 필요합니다." }, { status: 403 });
  }
  return Response.json({ notes: state.session.pdfKey?.startsWith("/samples/") ? notes : [] }, { headers: { "Cache-Control": "private, no-store" } });
}
