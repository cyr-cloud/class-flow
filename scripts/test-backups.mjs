import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const id=`backup-test-${randomUUID()}`,token=randomUUID(),base='http://127.0.0.1:3311';
const headers={'Content-Type':'application/json','x-teacher-token':token};
async function send(body){const r=await fetch(`${base}/api/live/${id}`,{method:'POST',headers,body:JSON.stringify(body)});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
async function list(){return (await (await fetch(`${base}/api/backups?sessionId=${id}`,{headers})).json()).backups;}
let state=await send({action:'sample'});
const file=`.classflow/session_${id}.json`;assert.ok(existsSync(file),'Must use isolated local storage');
const content={id:randomUUID(),type:'wordcloud',prompt:'백업 보존 테스트'};
state=await send({action:'insertSlide',anchor:1,side:'before',title:content.prompt,content,expectedDeckUpdatedAt:state.deck.updatedAt});
await send({action:'wordRespond',slideId:content.id,responderId:'test-only',word:'보존할 응답'});
await send({action:'backup'});
let backups=await list();const answerBackup=backups.find(x=>x.answers===1);assert.ok(answerBackup);
const before=backups.length;await send({action:'backup'});assert.equal((await list()).length,before,'Unchanged state must not add backups');
await send({action:'wordRespond',slideId:content.id,responderId:'test-only-2',word:'추가 응답'});
const stored=JSON.parse(readFileSync(file,'utf8'));stored.backupAt=Date.now()-301000;writeFileSync(file,JSON.stringify(stored));
await send({action:'patch',partial:{currentSlide:1}});assert.ok((await list()).some(x=>x.answers===2),'5-minute server checkpoint');
state=await send({action:'sample'});assert.equal(state.wordResponses.length,0);
backups=await list();const r=await fetch(`${base}/api/backups?sessionId=${id}&revision=${answerBackup.revision}`,{headers});const archive=await r.json();assert.equal(archive.state.wordResponses[0].word,'보존할 응답');assert.ok(!JSON.stringify(archive).includes(token));
assert.equal((await fetch(`${base}/api/backups?sessionId=${id}`)).status,403);
assert.equal((await fetch(`${base}/api/backups?sessionId=${id}&revision=${answerBackup.revision}`)).status,403);
const indexFile=`.classflow/backup-index_${id}.json`;
const indexRaw=readFileSync(indexFile,'utf8'), stateRaw=readFileSync(file,'utf8');
writeFileSync(indexFile,'invalid-test-index');
try {
 const failed=await fetch(`${base}/api/live/${id}`,{method:'POST',headers,body:JSON.stringify({action:'sample'})});
 assert.equal(failed.status,400,'Failed backup must block replacement');
 assert.equal(readFileSync(file,'utf8'),stateRaw,'Failed backup must leave original state unchanged');
} finally {writeFileSync(indexFile,indexRaw);}
console.log(JSON.stringify({result:'PASS',session:id,backups:backups.length,responsePreservedAfterSample:true,unchangedDedup:true,periodicCheckpoint:true,unauthorizedDenied:true,noCredentialsInArchive:true,backupFailureBlocksReset:true}));
