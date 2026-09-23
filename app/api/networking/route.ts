import preset from "@/data/events/networking-20260923.json";
import {readSession,isTeacher} from "@/lib/live/server";

export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const id=new URL(request.url).searchParams.get("sessionId")??"";
  const state=await readSession(id,true);
  if(!state||!isTeacher(state,request.headers.get("x-teacher-token")??"")||state.session.pdfKey!==preset.pdfKey)
    return Response.json({error:"오늘 수업을 만든 브라우저에서 열어 주세요."},{status:403,headers:{"Cache-Control":"no-store"}});
  return Response.json(preset,{headers:{"Cache-Control":"private, no-store"}});
}
