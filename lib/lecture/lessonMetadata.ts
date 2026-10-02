import type {Metadata} from "next";

export function lessonMetadata(sessionId:string,role:"teacher"|"student",session:{title?:string|null,pdfName?:string|null}|null):Metadata {
  const name=session?.title?.trim()||session?.pdfName?.replace(/\.(pptx|pdf)$/i,"").trim()||"ClassFlow 강의";
  const roleName=role==="teacher"?"강사용":"학생용";
  const title=`${name} (${roleName})`;
  const description=role==="teacher"?"강의 진행·슬라이드 제어·참여 결과 확인을 위한 강사 화면입니다.":"슬라이드를 함께 보고 설문·퀴즈에 참여하는 학생 화면입니다.";
  const url=`/${role}/${encodeURIComponent(sessionId)}`;
  return {title,description,robots:{index:false,follow:false},openGraph:{title,description,url,type:"website",siteName:"ClassFlow",locale:"ko_KR",images:[]},twitter:{card:"summary",title,description,images:[]}};
}
