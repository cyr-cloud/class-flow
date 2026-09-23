import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const preset=JSON.parse(await readFile('data/events/networking-20260923.json','utf8'));
const base=process.env.TEST_CLASSFLOW_URL??'http://127.0.0.1:3311';
const id=`network-test-${randomUUID().slice(0,8)}`,token=randomUUID();
async function send(command,teacher=true,status=200) {
 const r=await fetch(`${base}/api/live/${id}`,{method:'POST',headers:{'Content-Type':'application/json',...(teacher?{'x-teacher-token':token}:{})},body:JSON.stringify(command)});
 const b=await r.json();assert.equal(r.status,status,b.error);return b;
}
const originals=preset.slides.filter(s=>!s.content);
assert.deepEqual(originals.map(s=>s.pdfPage),Array.from({length:28},(_,i)=>i+1));
assert.deepEqual(preset.slides.filter(s=>s.content).map(s=>s.slideNo),[24,25,26,27,28,32,33,34,35,36]);
let state=await send({action:'replaceMaterial',name:preset.name,pdfKey:preset.pdfKey,deck:{sessionId:id,classId:null,slides:preset.slides,source:'pdf',updatedAt:Date.now()}});
assert.equal(state.session.totalSlides,38);
assert.equal(state.wordResponses.length+state.surveyResponses.length,0);
for(const slide of preset.slides.filter(s=>s.content)) {
 await send({action:'patch',partial:{currentSlide:slide.slideNo}});
 const c=slide.content;
 for(const responderId of ['test-a','test-b']) await send(c.type==='wordcloud'?{action:'wordRespond',slideId:c.id,responderId,word:'경험공유'}:{action:'surveyRespond',slideId:c.id,responderId,text:'실시간 참여 확인'},false);
 state=await send(c.type==='wordcloud'?{action:'wordRespond',slideId:c.id,responderId:'test-a',word:'수정확인'}:{action:'surveyRespond',slideId:c.id,responderId:'test-a',text:'수정한 응답'},false);
 const responses=c.type==='wordcloud'?state.wordResponses:state.surveyResponses;
 assert.equal(responses.filter(r=>r.slideId===c.id).length,2);
}
for(const display of ['bar','pie','donut']) {
 const content={id:randomUUID(),type:'survey',prompt:`검증용 ${display}`,display,options:['A','B','C'],multiple:display==='donut'};
 state=await send({action:'insertSlide',anchor:38,side:'after',content,title:content.prompt,expectedDeckUpdatedAt:state.deck.updatedAt});
 await send({action:'patch',partial:{currentSlide:39}});
 await send({action:'surveyRespond',slideId:content.id,responderId:'test-a',choices:[0]},false);
 state=await send({action:'surveyRespond',slideId:content.id,responderId:'test-b',choices:content.multiple?[0,2]:[2]},false);
 assert.equal(state.surveyResponses.filter(r=>r.slideId===content.id).length,2);
}
await new Promise(r=>setTimeout(r,600));
const publicState=await(await fetch(`${base}/api/live/${id}`)).json();
assert.equal(publicState.wordResponses.length,6);assert.equal(publicState.surveyResponses.length,20);
assert.equal(JSON.stringify(publicState).includes(token),false);
console.log(JSON.stringify({result:'PASS',sessionId:id,originalPages:28,activities:10,types:['wordcloud','cards','bar','pie','donut'],responseEditing:true,persisted:true}));
