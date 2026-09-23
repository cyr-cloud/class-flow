import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
function storage(changeWhileWaiting) {
 const files=new Map(); let fail=true, delays=0;
 const fs={mkdirSync:()=>{},existsSync:p=>files.has(p),readFileSync:p=>files.get(p),writeFileSync:(p,v)=>files.set(p,v),renameSync:(a,b)=>{if(fail){fail=false;throw Object.assign(new Error('locked'),{code:'EPERM'});}files.set(b,files.get(a));files.delete(a);}};
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../lib/live/storage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,require:n=>n==='node:fs'?fs:path,process:{cwd:()=>'/test',env:{CLASSFLOW_LOCAL_ONLY:'1'}},setTimeout:cb=>{delays++; if(changeWhileWaiting) files.set(path.join('/test','.classflow','session_test.json'),'other'); cb();}});
 return {kv:exports.kv(),files,delays:()=>delays};
}
test('local file lock retries successfully',async()=>{const s=storage(false); assert.equal(await s.kv.compareAndSet('session:test',null,'next'),true); assert.equal(await s.kv.get('session:test'),'next'); assert.equal(s.delays(),1);});
test('local lock retry rechecks CAS and preserves intervening write',async()=>{const s=storage(true); assert.equal(await s.kv.compareAndSet('session:test',null,'next'),false); assert.equal(await s.kv.get('session:test'),'other');});
