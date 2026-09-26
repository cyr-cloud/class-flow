import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { localDatabase } from './local-db.mjs';
import { ChatStore } from './store.mjs';
import { createChatServer } from './server.mjs';
const secret = 'local-test-only-secret-'.repeat(3), origin = 'http://127.0.0.1:3311';
const actor = (n, room='room-a', role='student') => ({ id: createHash('sha256').update(String(n)).digest('hex'), name: `학생 ${n}`, room, role, exp: Date.now()+60000 });
function ticket(a) { const data=Buffer.from(JSON.stringify(a)).toString('base64url'); return `${data}.${createHmac('sha256',secret).update(data).digest('base64url')}`; }
function nextSnapshot(s, condition) { return new Promise((resolve,reject) => { const timer=setTimeout(()=>{s.off('snapshot',handler);reject(Error('snapshot timeout'));},10000); const handler=data=>{if(condition(data)){clearTimeout(timer);s.off('snapshot',handler);resolve(data);}};s.on('snapshot',handler); }); }

test('real sockets: durable messages, reactions, isolation, role checks, reconnect, history', async () => {
  const directory = await mkdtemp(join(tmpdir(),'classflow-chat-test-'));
  let db = await localDatabase(directory), store = new ChatStore(db); await store.init();
  const server=createChatServer(store,{secret,origins:[origin]});
  await new Promise(r=>server.http.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.http.address().port}`, sockets=[];
  const connect = async a => { const s=io(url,{auth:{ticket:ticket(a)},transports:['websocket'],extraHeaders:{Origin:origin},autoConnect:false});sockets.push(s);const received=nextSnapshot(s,()=>true);s.connect();await received;return s; };
  try {
    const teacher=await connect(actor('teacher','room-a','teacher'));
    const students=await Promise.all(Array.from({length:30},(_,i)=>connect(actor(i))));
    const foreign=await connect(actor('outsider','room-b'));
    const received=nextSnapshot(students[0],s=>s.messages.some(m=>m.text==='step 3'));
    const posted=await teacher.timeout(10000).emitWithAck('command',{type:'message',clientId:'message-0001',text:'step 3'});assert.equal(posted.ok,true);await received;
    const id=posted.id;
    const duplicate=await teacher.timeout(10000).emitWithAck('command',{type:'message',clientId:'message-0001',text:'step 3'});assert.equal(duplicate.id,id);
    assert.equal((await students[0].timeout(10000).emitWithAck('command',{type:'pin',messageId:id,active:true})).ok,false);
    assert.equal((await foreign.timeout(10000).emitWithAck('command',{type:'reaction',messageId:id,emoji:'✅',active:true})).ok,false);
    assert.equal((await teacher.timeout(10000).emitWithAck('command',{type:'pin',messageId:id,active:true})).ok,true);
    const reacted=nextSnapshot(teacher,s=>s.pinned?.reactions.length===30);
    const results=await Promise.all(students.map(s=>s.timeout(15000).emitWithAck('command',{type:'reaction',messageId:id,emoji:'✅',active:true})));
    assert.ok(results.every(r=>r.ok)); const snapshot=await reacted;
    assert.equal(snapshot.people.length,30);assert.equal(new Set(snapshot.pinned.reactions.map(r=>r.actor)).size,30);
    await students[0].timeout(10000).emitWithAck('command',{type:'reaction',messageId:id,emoji:'✅',active:true});
    assert.equal((await store.snapshot('room-a')).pinned.reactions.length,30);
    await students[0].timeout(10000).emitWithAck('command',{type:'reaction',messageId:id,emoji:'✅',active:false});
    assert.equal((await store.snapshot('room-a')).pinned.reactions.length,29);
    const publicData=await store.snapshot('room-a');assert.equal('people' in publicData,false);
    assert.equal((await store.snapshot('room-b')).messages.length,0);
    students[1].disconnect();
    await teacher.timeout(10000).emitWithAck('command',{type:'message',clientId:'message-0002',text:'재접속 복구'});
    const recovered=nextSnapshot(students[1],s=>s.messages.some(m=>m.text==='재접속 복구'));students[1].connect();await recovered;
    const bad=io(url,{auth:{ticket:ticket({...actor('bad'),exp:Date.now()-1})},transports:['websocket'],extraHeaders:{Origin:origin},reconnection:false});sockets.push(bad);
    await new Promise(resolve=>bad.on('connect_error',resolve)); assert.equal(bad.connected,false);
    for(let i=0;i<105;i++) await store.command(actor('teacher','room-a','teacher'),{type:'message',clientId:`history-${i}`,text:`older ${i}`});
    const recent=await store.snapshot('room-a');assert.equal(recent.messages.length,100);assert.equal(recent.hasMore,true);assert.equal(recent.pinned.id,id);
    assert.equal((await store.snapshot('room-a',false,recent.messages[0].id)).messages.length,7);
    await server.close();sockets.forEach(s=>s.disconnect());await db.end();
    db=await localDatabase(directory);store=new ChatStore(db);
    const persisted=await store.snapshot('room-a',true);assert.equal(persisted.pinned.reactions.length,29);assert.equal(persisted.people.length,30);
  } finally { sockets.forEach(s=>s.disconnect());await server.close();await db.end();await rm(directory,{recursive:true,force:true}); }
});
