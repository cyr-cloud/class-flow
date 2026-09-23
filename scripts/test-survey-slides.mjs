import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
const base='http://127.0.0.1:3311', id=`survey-test-${randomUUID()}`, token=randomUUID(), url=`${base}/api/live/${id}`;
async function send(command,teacher=true,status=200) {
 const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(teacher?{'x-teacher-token':token}:{})},body:JSON.stringify(command)});
 const body=await res.json(); assert.equal(res.status,status,JSON.stringify(body)); return body;
}
let state=await send({action:'sample'});
assert.ok(existsSync(`.classflow/session_${id}.json`),'Test must use local storage');
async function insert(display,multiple=false) {
 const content={id:randomUUID(),type:'survey',prompt:`TEST ${display}`,display,options:display==='cards'?[]:['처음','가끔','자주'],multiple};
 const cmd={action:'insertSlide',anchor:1,side:'before',title:content.prompt,content,expectedDeckUpdatedAt:state.deck.updatedAt};
 await send(cmd,false,400); state=await send(cmd); return content;
}
const card=await insert('cards');
const text='공식 문서에서 확인합니다.\n실습은 직접 해 봅니다. '+ '가'.repeat(450);
state=await send({action:'surveyRespond',slideId:card.id,responderId:'first',text},false);
assert.equal(state.surveyResponses[0].text,text);
state=await send({action:'surveyRespond',slideId:card.id,responderId:'first',text:'수정한 답변'},false);
assert.equal(state.surveyResponses.length,1);
assert.equal(state.surveyResponses[0].text,'수정한 답변');
await send({action:'surveyRespond',slideId:card.id,responderId:'bad',text:'가'.repeat(501)},false,400);
await send({action:'surveyRespond',slideId:card.id,responderId:'bad',text:' '},false,400);
for(const display of ['bar','pie','donut']) {
 const slide=await insert(display,display==='donut');
 await send({action:'surveyRespond',slideId:card.id,responderId:'late',text:'늦음'},false,400);
 state=await send({action:'surveyRespond',slideId:slide.id,responderId:'first',choices:[1]},false);
 state=await send({action:'surveyRespond',slideId:slide.id,responderId:'first',choices:[2]},false);
 assert.equal(state.surveyResponses.filter(r=>r.slideId===slide.id).length,1);
 assert.deepEqual(state.surveyResponses.find(r=>r.slideId===slide.id).choices,[2]);
 await send({action:'surveyRespond',slideId:slide.id,responderId:'bad',choices:[3]},false,400);
 await send({action:'surveyRespond',slideId:slide.id,responderId:'bad',choices:[1,1]},false,400);
 if(slide.multiple) {state=await send({action:'surveyRespond',slideId:slide.id,responderId:'second',choices:[2,0]},false); assert.deepEqual(state.surveyResponses.at(-1).choices,[0,2]);}
 else await send({action:'surveyRespond',slideId:slide.id,responderId:'bad',choices:[0,1]},false,400);
}
const persisted=await (await fetch(url)).json();
assert.equal(persisted.surveyResponses.length,5);
assert.ok(persisted.deck.slides.every(s=>s.items.every(q=>q.answers.length===0)));
const crowd=await insert('cards');
await Promise.all(Array.from({length:40},(_,i)=>send({action:'surveyRespond',slideId:crowd.id,responderId:'crowd-'+i,text:'LOCAL TEST '+i},false)));
const crowdState=await (await fetch(url)).json(); assert.equal(crowdState.surveyResponses.filter(r=>r.slideId===crowd.id).length,40);
state=await send({action:'sample'}); assert.deepEqual(state.surveyResponses,[]);
console.log('PASS: isolated local session, teacher-only insertion, cards/bar/pie/donut, long text/newlines, response edits, validation, single/multiple choices, inactive slide rejection, persistence and reset');

