import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupCloudWords,layoutCloud,cloudBoxesOverlap} from '../lib/lecture/wordCloudLayout.ts';
function check(words){const p=layoutCloud(words);assert.equal(p.length,words.length);for(let i=0;i<p.length;i++){const a=p[i];assert.ok(a.x-a.width/2>=0&&a.x+a.width/2<=1000&&a.y-a.height/2>=0&&a.y+a.height/2<=520);for(let j=i+1;j<p.length;j++)assert.equal(cloudBoxesOverlap(a,p[j]),false,`${a.word} overlaps ${p[j].word}`);}return p;}
test('Korean cloud groups repeated words and makes popular words larger',()=>{const p=check(groupCloudWords([...Array(12).fill({word:'신소재공학과'}),...Array(7).fill({word:'전자공학과'}),...['경영학과','중국어과','화학과','기계','토목공학과','물리학과'].map(word=>({word}))]));assert.ok(p[0].fontSize>p[1].fontSize);assert.ok(p[1].fontSize>p[2].fontSize);assert.ok(new Set(p.map(w=>w.y)).size>4);assert.deepEqual(p,layoutCloud([...p].reverse()));});
test('200 long Korean answers fit without disappearing or overlapping',()=>{check(Array.from({length:200},(_,i)=>({word:`아주길게작성한강의준비경험${i}`,count:1})));});
test('empty/single and Latin grouping',()=>{assert.deepEqual(layoutCloud([]),[]);check([{word:'안녕하세요',count:1}]);assert.deepEqual(groupCloudWords([{word:'AI'},{word:'ai'}]),[{word:'AI',count:2}]);});
