import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lessonMetadata} from '../lib/lecture/lessonMetadata.ts';
test('lecture name and role distinguish document, OG and Twitter titles',()=>{
 for(const [role,label] of [['teacher','강사용'],['student','학생용']]){
  const m=lessonMetadata('room',role,{title:'코파일럿 라이브',pdfName:'old.pptx'});
  assert.equal(m.title,`코파일럿 라이브 (${label})`);
  assert.equal(m.openGraph.title,m.title);assert.equal(m.twitter.title,m.title);
  assert.equal(m.openGraph.url,`/${role}/room`);
  assert.equal(m.robots.index,false);
 }
});
test('file-name and missing-session fallbacks retain role; no private key in metadata',()=>{
 assert.equal(lessonMetadata('room','teacher',{pdfName:'수업.pptx'}).title,'수업 (강사용)');
 const m=lessonMetadata('room','student',null);
 assert.equal(m.title,'ClassFlow 강의 (학생용)');
 assert.equal(m.openGraph.url,'/student/room');
});
