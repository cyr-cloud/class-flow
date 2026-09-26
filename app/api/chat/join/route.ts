import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isTeacher, readSession, validId } from "@/lib/live/server";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const secret = process.env.CHAT_TOKEN_SECRET;
  const url = process.env.CHAT_SERVER_URL;
  if (!secret || secret.length < 32 || !url) return NextResponse.json({ error: "채팅 서버 연결을 준비 중이에요." }, { status: 503 });
  // Next's development server normalizes nextUrl to localhost even when the
  // browser visits 127.0.0.1. Compare against the actual request Host as well.
  const origin = request.headers.get('origin');
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get('host')}`;
  if (!origin || (origin !== request.nextUrl.origin && origin !== expectedOrigin)) return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) throw Error('요청이 너무 커요.');
    const { sessionId, name, role } = await request.json();
    if (typeof sessionId !== 'string' || !validId(sessionId) || !['teacher', 'student'].includes(role)) throw Error('수업을 확인해 주세요.');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 30 || /[\u0000-\u001f]/.test(name)) throw Error('이름 또는 닉네임을 1~30자로 입력해 주세요.');
    const session = await readSession(sessionId);
    if (!session) return NextResponse.json({ error: '수업을 찾을 수 없어요.' }, { status: 404 });
    if (role === 'teacher' && !isTeacher(session, request.headers.get('x-teacher-token') || '')) return NextResponse.json({ error: '수업을 연 강사만 강사로 채팅할 수 있어요.' }, { status: 403 });
    const cookie = request.cookies.get('classflow-chat-identity')?.value;
    const identity = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : randomBytes(32).toString('hex');
    const id = createHash('sha256').update(`${identity}:${sessionId}:${role}`).digest('hex');
    const actor = { room: sessionId, id, name: role === 'teacher' ? '강사' : name.trim(), role, exp: Date.now() + 8 * 60 * 60 * 1000 };
    const data = Buffer.from(JSON.stringify(actor)).toString('base64url');
    const ticket = `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
    const response = NextResponse.json({ ticket, url, actor }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('classflow-chat-identity', identity, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 365 * 24 * 60 * 60 });
    return response;
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : '채팅 입장에 실패했어요.' }, { status: 400 }); }
}
