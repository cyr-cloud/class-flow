import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as survey from '../lib/lecture/survey.ts';
function renderer() {
 const drawn=[]; let current=[];
 const ctx={measureText:text=>({width:text.length*20}),fillText:text=>current.push(text),fillRect:()=>{},beginPath:()=>{},arc:()=>{},fill:()=>{},moveTo:()=>{},closePath:()=>{}};
 const canvas={getContext:()=>ctx,toBlob:cb=>{drawn.push(current);current=[];cb(new Blob(['png']));}};
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../lib/lecture/renderSurveyPdf.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:()=>survey,document:{fonts:{ready:Promise.resolve()},createElement:()=>canvas},Blob,Uint8Array});
 return {render:exports.renderSurveyPdf,drawn};
}
test('long answer export creates continuation pages and preserves every answer line',async()=>{
 const {render,drawn}=renderer();
 const content={id:'cards',type:'survey',prompt:'질문',display:'cards',options:[],multiple:false};
 const answers=Array.from({length:40},(_,i)=>({slideId:'cards',responderId:`r${i}`,text:`ANSWER_${i}\nDETAIL_${i}\nEND_${i}`}));
 const result=await render(content,answers); assert.ok(result.length>1);
 const all=drawn.flat();
 for(let i=0;i<40;i++) {assert.ok(all.includes(`${i+1}. ANSWER_${i}`)); assert.ok(all.includes(`DETAIL_${i}`)); assert.ok(all.includes(`END_${i}`));}
});
test('all chart exports include correct choice counts',async()=>{
 for(const display of ['bar','pie','donut']) {
  const {render,drawn}=renderer();
  await render({id:'c',type:'survey',prompt:'질문',display,options:['A','B'],multiple:true},[{slideId:'c',responderId:'a',choices:[0,1]}]);
  assert.ok(drawn.flat().includes('A — 1표 (50%)')); assert.ok(drawn.flat().includes('B — 1표 (50%)'));
 }
});
