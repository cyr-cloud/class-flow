import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanSurvey,cleanSurveyResponse,surveyCounts} from '../lib/lecture/survey.ts';
const content={id:'slide',type:'survey',prompt:'질문',display:'bar',options:[' A ','B'],multiple:false};
test('survey options are trimmed, duplicates and invalid displays rejected',()=>{
 assert.deepEqual(cleanSurvey(content).options,['A','B']);
 assert.throws(()=>cleanSurvey({...content,options:['A',' A ']}));
 assert.throws(()=>cleanSurvey({...content,display:'unknown'}));
 assert.throws(()=>cleanSurvey({...content,options:['A']}));
});
test('cards preserve long text/newlines and enforce bounds',()=>{
 const card={...content,display:'cards'};
 assert.equal(cleanSurveyResponse(card,{responderId:'abc',text:' 가\r\n나 '}).text,'가\n나');
 assert.equal(cleanSurveyResponse(card,{responderId:'abc',text:'가'.repeat(500)}).text.length,500);
 for(const text of ['','가'.repeat(501),'bad\u0000']) assert.throws(()=>cleanSurveyResponse(card,{responderId:'abc',text}));
});
test('multiple choices count selections once and isolate slides',()=>{
 const multi={...content,multiple:true};
 const response=cleanSurveyResponse(multi,{responderId:'abc',choices:[1,0]});
 assert.deepEqual(response.choices,[0,1]);
 assert.throws(()=>cleanSurveyResponse(content,{responderId:'abc',choices:[0,1]}));
 assert.throws(()=>cleanSurveyResponse(multi,{responderId:'abc',choices:[1,1]}));
 assert.throws(()=>cleanSurveyResponse(multi,{responderId:'abc',choices:[-1]}));
 assert.deepEqual(surveyCounts(multi,[response,{slideId:'other',choices:[0]}]).map(x=>x.count),[1,1]);
});
