import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {extractNotes} from '../lib/lecture/pptxNotes.ts';
const base=process.env.TEST_CLASSFLOW_URL??'http://127.0.0.1:3311';
const id=`ppt-import-test-${randomUUID().slice(0,8)}`,token=randomUUID();
const ppt=await readFile('../lecture-harness/projects/20260901-jeonju-vibecoding-mvp/02-slides/s09-claude-md-rules/generated/decks/jeonju-vibecoding-day-09.pptx');
const notes=extractNotes(ppt.buffer.slice(ppt.byteOffset,ppt.byteOffset+ppt.byteLength));
const pdfKey='https://example.com/import-test.pdf';
const slides=[48,50].map(n=>({slideNo:n,pdfPage:n,title:n===48?'퀴즈-읽힌 파일 확인':'퀴즈-지울 줄 고르기',kind:'quiz',items:[],labNo:null,boardId:null}));
const headers={'Content-Type':'application/json','x-teacher-token':token};
async function send(command,teacher=true,status=200) {
 const r=await fetch(`${base}/api/live/${id}`,{method:'POST',headers:teacher?headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
 const b=await r.json();assert.equal(r.status,status,b.error);return b;
}
await send({action:'replaceMaterial',pdfKey,name:'test.pptx',deck:{sessionId:id,classId:null,slides,source:'pdf',updatedAt:Date.now()}});
for(const slide of slides) {
 const form=new FormData();form.set('slideNo',String(slide.slideNo));form.set('pdfKey',pdfKey);form.set('notes',notes.find(n=>n.slideNo===slide.slideNo).text);form.set('image',new Blob([await readFile(`output/networking/quiz-${slide.slideNo}.png`)],{type:'image/png'}),'quiz.png');
 const unauth=await fetch(`${base}/api/import-quiz?sessionId=${id}`,{method:'POST',body:form});assert.equal(unauth.status,403);
 const r=await fetch(`${base}/api/import-quiz?sessionId=${id}`,{method:'POST',headers:{'x-teacher-token':token},body:form});const result=await r.json();assert.equal(r.status,200,result.error);
 assert.equal(result.items.length,1);assert.equal(result.items[0].options.length,4);assert.deepEqual(result.items[0].answers,[1]);
 const command={action:'importQuiz',slideNo:slide.slideNo,pdfPage:slide.pdfPage,pdfKey,items:result.items};
 await send(command,false,400);await send({...command,pdfKey:'https://example.com/wrong.pdf'},true,400);
 await send(command);const state=await send(command);assert.equal(state.deck.slides.find(s=>s.slideNo===slide.slideNo).items.length,1);
 console.log(JSON.stringify({page:slide.slideNo,result:'PASS',question:result.items[0].question,options:result.items[0].options,answers:result.items[0].answers}));
}
