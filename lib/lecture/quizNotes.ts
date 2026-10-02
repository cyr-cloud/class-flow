import {z} from "zod";

export const ImportedQuizResult=z.object({items:z.array(z.object({question:z.string().min(1),options:z.array(z.string().min(1)).min(2).max(9),answers:z.array(z.number().int()).min(1)})).min(1).max(10),reason:z.string()});

// Explicit, machine-readable source in speaker notes. Never infer an answer
// from prose, execute note instructions, or silently fall back on corrupt data.
export function quizFromNotes(notes:string) {
  const start="[ClassFlow Quiz JSON]",end="[/ClassFlow Quiz JSON]";
  const at=notes.indexOf(start);
  if(at<0) return null;
  const stop=notes.indexOf(end,at+start.length);
  if(stop<0||notes.indexOf(start,at+start.length)>=0) throw Error("발표자 노트의 퀴즈 원문 블록을 확인해 주세요.");
  let raw:unknown;
  try {raw=JSON.parse(notes.slice(at+start.length,stop).trim());}
  catch {throw Error("발표자 노트의 퀴즈 원문 JSON을 확인해 주세요.");}
  const result=ImportedQuizResult.safeParse(raw);
  if(!result.success) throw Error("발표자 노트의 질문·선택지·정답 형식을 확인해 주세요.");
  for(const item of result.data.items) {
    if(!item.question.trim()||item.options.some(o=>!o.trim())||new Set(item.answers).size!==item.answers.length||item.answers.some(a=>a<0||a>=item.options.length)) throw Error("발표자 노트의 선택지와 정답 번호를 확인해 주세요.");
  }
  return {...result.data,reason:""};
}
