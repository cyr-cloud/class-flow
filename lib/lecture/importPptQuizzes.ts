import {liveClient} from "../live/client";
import {quizPageImages} from "./pdfTitles";
import type {SlideNote} from "./pptxNotes";

export async function importPptQuizzes(sessionId:string,notes:SlideNote[],progress:(s:string)=>void) {
  const client=liveClient(sessionId), initial=client.snapshot();
  const pdfKey=initial.session.pdfKey;
  const slides=initial.deck?.slides.filter(s=>s.kind==="quiz"&&!s.content&&!s.items.length)??[];
  if(!slides.length) return "불러올 빈 퀴즈 페이지가 없습니다.";
  if(!pdfKey) throw Error("PPT를 먼저 올려 주세요.");
  progress(`PPT 속 퀴즈 ${slides.length}쪽을 읽고 있어요. 기존 문제와 선택지를 그대로 옮깁니다…`);
  const images=await quizPageImages(pdfKey,slides.map(s=>s.pdfPage??s.slideNo));
  const failed:string[]=[]; let saved=0;
  for(const [i,slide] of slides.entries()) {
    const originalPage=slide.pdfPage??slide.slideNo;
    const note=notes.find(n=>n.slideNo===originalPage);
    progress(`PPT 퀴즈 불러오는 중 ${i+1}/${slides.length} · ${slide.slideNo}쪽. 완료된 문항은 바로 저장됩니다.`);
    try {
      if(client.snapshot().session.pdfKey!==pdfKey) throw Error("자료가 교체되어 불러오기를 중단했어요.");
      if(!note?.text.trim()) throw Error("발표자 노트가 없어 정답을 확인할 수 없음");
      const form=new FormData();form.set("slideNo",String(slide.slideNo));form.set("pdfKey",pdfKey);form.set("notes",note.text);form.set("image",images.get(originalPage)!,"quiz.png");
      const response=await fetch(`/api/import-quiz?sessionId=${encodeURIComponent(sessionId)}`,{method:"POST",headers:{"x-teacher-token":localStorage.getItem(`classflow:teacher:${sessionId}`)??""},body:form,signal:AbortSignal.timeout(60000)});
      const result=await response.json();
      if(!response.ok||!result.items?.length) throw Error(result.error||result.reason||"기존 문항을 확인하지 못함");
      if(client.snapshot().session.pdfKey!==pdfKey) throw Error("자료가 교체되어 불러오기를 중단했어요.");
      // A retry never duplicates a slide that already has questions.
      if(client.snapshot().deck?.slides.find(s=>s.slideNo===slide.slideNo)?.items.length) continue;
      await client.send({action:"importQuiz",slideNo:slide.slideNo,pdfPage:originalPage,pdfKey,items:result.items});
      saved++;
    } catch(error) {failed.push(`${slide.slideNo}쪽: ${error instanceof Error?error.message:"불러오기 실패"}`);}
  }
  return `PPT 퀴즈 ${saved}쪽을 불러왔어요.${failed.length?` 확인이 필요한 ${failed.length}쪽 — ${failed.join(" / ")}. ‘PPT 퀴즈 다시 불러오기’로 재시도할 수 있어요.`:" 기존 문제·선택지·정답을 확인해 주세요."}`;
}
