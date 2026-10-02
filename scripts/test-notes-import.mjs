import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {extractNotes} from '../lib/lecture/pptxNotes.ts';
const base='http://127.0.0.1:3322';
const id='notes-import-'+randomUUID().slice(0,8),token=randomUUID();
const bytes=await readFile('../lecture-harness/projects/20261002-crowd-copilot-live/02-slides/s01-copilot-live/generated/decks/crowd-copilot-live-transparent-v1.pptx');
const notes=extractNotes(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const pdfKey='https://example.com/notes-test.pdf';
const slides=[17,18,19].map(slideNo=>({slideNo,pdfPage:slideNo,title:'퀴즈',kind:'quiz',items:[],labNo:null,boardId:null}));
const headers={'Content-Type':'application/json','x-teacher-token':token};
let r=await fetch(`${base}/api/live/${id}`,{method:'POST',headers,body:JSON.stringify({action:'replaceMaterial',pdfKey,name:'코파일럿 라이브.pptx',deck:{sessionId:id,classId:null,slides,source:'pdf',updatedAt:Date.now()}})});
assert.equal(r.status,200);
for(const [i,slide] of slides.entries()){
 const form=new FormData();form.set('slideNo',String(slide.slideNo));form.set('pdfKey',pdfKey);form.set('notes',notes.find(n=>n.slideNo===slide.slideNo).text);
 // No image is submitted: complete source in notes requires no AI call.
 r=await fetch(`${base}/api/import-quiz?sessionId=${id}`,{method:'POST',body:form});assert.equal(r.status,403);
 r=await fetch(`${base}/api/import-quiz?sessionId=${id}`,{method:'POST',headers:{'x-teacher-token':token},body:form});
 const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));
 assert.equal(result.items.length,1);assert.equal(result.items[0].options.length,i===0?2:4);assert.deepEqual(result.items[0].answers,[i+1]);
 if(i===2){assert.match(result.items[0].question,/\(가\) Excel/);assert.match(result.items[0].question,/ㄷ\. 예상/);assert.equal(result.items[0].options[3],'(가)ㄴ (나)ㄱ (다)ㄷ');}
 console.log(`PPT page ${slide.slideNo}: complete quiz imported without image/AI; answer ${i+2}`);
}
for(const [role,label] of [['teacher','강사용'],['student','학생용']]){
 const html=await(await fetch(`${base}/${role}/${id}`,{headers:{'User-Agent':'facebookexternalhit/1.1'}})).text();
 const title=`코파일럿 라이브 (${label})`;
 assert.ok(html.includes(`<title>${title}</title>`),html.match(/<title>.*?<\/title>/)?.[0]);
 assert.ok(html.includes(`property="og:title" content="${title}"`));
 assert.ok(html.includes(`name="twitter:title" content="${title}"`));
 assert.ok(!html.includes(token));
 console.log(`${role}: document/OG/Twitter lecture-role titles verified; no teacher token`);
}
