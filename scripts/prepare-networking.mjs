// Explicit one-off event preparation. No credentials are written into public output.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID, randomBytes, createCipheriv} from 'node:crypto';
import {put} from '@vercel/blob/client';
import {PDFDocument} from 'pdf-lib';

const root=process.argv[2];
if(!root || !process.argv.includes('--confirm-upload')) throw Error('Provide event folder and --confirm-upload');
const base=process.env.TEST_CLASSFLOW_URL ?? 'https://class-flow-fawn.vercel.app';
const source=await readFile(join(root,'02-slides/day01-networking/slides_강사네트워킹.md'),'utf8');
const guide=await readFile(join(root,'03-guides/day01-networking/guide_activity_강사경험공유.md'),'utf8');
const titles=[...source.matchAll(/^## 슬라이드 (\d+): (.+)$/gm)].map(m=>m[2].trim());
const questions=[...guide.matchAll(/^### Q(\d+)\. (.+)$/gm)].map(m=>m[2].trim());
assert.equal(titles.length,28); assert.equal(questions.length,9);
assert.match(titles[22],/첫 강의/); assert.match(titles[25],/수업할 때/);
const groups=[questions.slice(0,4).concat('강의 준비에서 가장 시간을 많이 쓰는 일은 무엇인가요?'),questions.slice(4)];
const slides=[];
for(let page=1;page<=28;page++) {
 slides.push({slideNo:slides.length+1,pdfPage:page,title:titles[page-1],kind:'normal',items:[],labNo:null,boardId:null});
 if(page!==23 && page!==26) continue;
 const part=page===23?1:2;
 for(const [i,prompt] of groups[part-1].entries()) {
  const cloud=part===1?(i===0||i===4):i===4;
  const content={id:`networking-20260923-part${part}-q${i+1}`,type:cloud?'wordcloud':'survey',prompt,...(!cloud?{display:'cards',options:[],multiple:false}:{})};
  slides.push({slideNo:slides.length+1,title:`경험 공유 ${part}부 · ${i+1}/5`,kind:'normal',items:[],labNo:null,boardId:null,content});
 }
}
assert.equal(slides.length,38);
const privatePath='.classflow/networking-preparation.json';
await mkdir('.classflow',{recursive:true});
let saved;
try {saved=JSON.parse(await readFile(privatePath,'utf8'));}catch{}
const sessionId=saved?.sessionId??`networking-source-${Date.now()}`, teacherToken=saved?.teacherToken??randomUUID();
const headers={'Content-Type':'application/json','x-teacher-token':teacherToken};
async function api(path,body) {
 const r=await fetch(base+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json(); assert.ok(r.ok,`${r.status} ${data.error??'Request failed'}`);return data;
}
const endpoint=`/api/conversions?sessionId=${sessionId}`;
if(!saved?.jobId) {
 await api(`/api/live/${sessionId}`,{action:'patch',partial:{}});
 const bytes=await readFile(join(root,'02-slides/day01-networking/generated/decks/networking-20260923-transparent-v2.pptx'));
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
 const job=await api(endpoint,{action:'prepare',name:'강사×운영자 네트워킹.pptx',key:key.toString('hex'),iv:iv.toString('hex'),inputBytes:encrypted.length});
 await put(job.pathname,encrypted,{token:job.token,access:'public',contentType:'application/octet-stream',multipart:true});
 await api(endpoint,{action:'submit',id:job.id});
 saved={sessionId,teacherToken,jobId:job.id}; await writeFile(privatePath,JSON.stringify(saved));
}
let job;
for(let i=0;i<150;i++) {
 job=await api(`${endpoint}&id=${saved.jobId}`);
 if(job.status==='done'||job.status==='failed')break;
 if(i%10===0)console.log(`Networking PPT: ${job.status}`);
 await new Promise(r=>setTimeout(r,4000));
}
assert.equal(job.status,'done',job.error??'Conversion pending');
const bytes=Buffer.from(await (await fetch(job.pdfUrl)).arrayBuffer());
assert.equal((await PDFDocument.load(bytes)).getPageCount(),28);
const manifest={version:1,name:'강사×운영자 네트워킹.pptx',sourceSession:sessionId,pdfKey:job.pdfUrl,slides};
await mkdir('public/events',{recursive:true});
await writeFile('public/events/networking-20260923.json',JSON.stringify(manifest,null,2)+'\n');
await mkdir('output/networking',{recursive:true});await writeFile('output/networking/converted.pdf',bytes);
console.log('Prepared: 28 original slides + 10 activities (3 word clouds, 7 cards); no responses or credentials in manifest.');
