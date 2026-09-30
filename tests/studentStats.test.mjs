import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeStudentStats,leaders} from '../lib/lecture/studentStats.ts';

const item=(id,answers)=>({id,slideNo:1,no:1,question:'Q',options:['a','b','c'],answers});
const deck={sessionId:'s',classId:null,source:'md',updatedAt:0,slides:[
 {slideNo:1,title:'퀴즈',kind:'quiz',labNo:null,boardId:null,items:[item('q1',[1]),item('q2',[0,2]),item('poll',[])]},
]};
const r=(itemId,responderId,choices,createdAt=1)=>({itemId,responderId,choiceIndex:choices[0],choiceIndices:choices,createdAt});
const post=(ownerId,authorName,likes=[])=>({id:ownerId+authorName,slideNo:2,authorName,description:'',imageUrl:null,ownerId,likes,createdAt:1});

test('counts answers, correctness (incl. multi-answer) and participation per student',()=>{
 const {students,summary}=computeStudentStats({deck,roster:{t1:{name:'민지',at:0},t2:{name:'서준',at:0}},
  responses:[r('q1','t1',[1]),r('q2','t1',[2,0]),r('poll','t1',[0]),r('q1','t2',[0])],posts:[]});
 const minji=students.find(s=>s.name==='민지'), seojun=students.find(s=>s.name==='서준');
 assert.equal(minji.quizAnswered,3); assert.equal(minji.quizGraded,2); assert.equal(minji.quizCorrect,2); assert.equal(minji.accuracy,100);
 assert.equal(seojun.quizCorrect,0); assert.equal(seojun.accuracy,0);
 assert.equal(summary.activitiesRun,3); assert.equal(minji.participation,100); assert.equal(seojun.participation,33);
});

test('merges tabs with the same name and keeps only the latest answer per item',()=>{
 const {students}=computeStudentStats({deck,roster:{a:{name:'민지',at:0},b:{name:'민지',at:0}},
  responses:[r('q1','a',[0],1),r('q1','b',[1],2)],posts:[]});
 assert.equal(students.length,1);
 assert.equal(students[0].quizAnswered,1); assert.equal(students[0].quizCorrect,1);
});

test('uses post author name when not in roster and ignores seed posts',()=>{
 const {students,summary}=computeStudentStats({deck,roster:{},responses:[],
  posts:[post('x','하윤',['x','y','z']),post('x','하윤'),post('seed','강사')]});
 assert.equal(summary.posts,2);
 assert.equal(students.length,1); assert.equal(students[0].name,'하윤');
 assert.equal(students[0].posts,2);
});

test('unnamed tabs get placeholders; chat-only students are listed; leaders handle ties and zeros',()=>{
 const {students}=computeStudentStats({deck,roster:{},responses:[r('q1','anon',[1])],posts:[]},{도윤:{count:3,samples:['안녕']}});
 assert.ok(students.some(s=>s.name==='학생 1'&&!s.named));
 const doyun=students.find(s=>s.name==='도윤'); assert.equal(doyun.chats,3); assert.equal(doyun.participation,0);
 assert.deepEqual(leaders(students,s=>s.posts),[]);
 assert.deepEqual(leaders(students,s=>s.chats).map(s=>s.name),['도윤']);
});

test('journal drafts are trimmed, normalized and bounded',async()=>{
 const {cleanJournalDraft}=await import('../lib/lecture/studentStats.ts');
 const d=cleanJournalDraft({summary:' 요약 \r\n둘째 줄 ',strengths:[' a ','',' b'],watch:[],suggestion:' s ',teacherNote:' 메모 '});
 assert.equal(d.summary,'요약 \n둘째 줄'); assert.deepEqual(d.strengths,['a','b']); assert.equal(d.teacherNote,'메모');
 assert.throws(()=>cleanJournalDraft({summary:'가'.repeat(801),strengths:[],watch:[],suggestion:'',teacherNote:''}));
 assert.throws(()=>cleanJournalDraft({summary:'x',strengths:new Array(6).fill('a'),watch:[],suggestion:'',teacherNote:''}));
 assert.throws(()=>cleanJournalDraft({summary:'x',strengths:'a',watch:[],suggestion:'',teacherNote:''}));
});
