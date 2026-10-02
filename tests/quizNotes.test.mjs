import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quizFromNotes} from '../lib/lecture/quizNotes.ts';
const item={question:'어떤 요청인가요?\n(가) 함수\nㄱ. 표 추출',options:['(가)ㄱ','(가)ㄴ','(가)ㄷ','(가)ㄹ'],answers:[3]};
const wrap=value=>'[학생 참여 요소] 채팅 [강의 대본] 설명 [ClassFlow Quiz JSON] '+JSON.stringify(value)+' [/ClassFlow Quiz JSON]';
test('preserves a matching quiz, option order and explicit zero-based answer',()=>assert.deepEqual(quizFromNotes(wrap({items:[item],reason:''})),{items:[item],reason:''}));
test('ordinary answer-only narration is not guessed into a question',()=>assert.equal(quizFromNotes('[강의 대본] 정답은 ④번입니다.'),null));
test('accepts OX and multiple explicit questions',()=>assert.equal(quizFromNotes(wrap({items:[{question:'맞나요?',options:['O','X'],answers:[1]},item],reason:''})).items.length,2));
test('rejects malformed, partial and duplicate blocks instead of AI fallback',()=>{
 for(const n of ['[ClassFlow Quiz JSON] {bad} [/ClassFlow Quiz JSON]','[ClassFlow Quiz JSON] {}',wrap({items:[item],reason:''})+wrap({items:[item],reason:''})])assert.throws(()=>quizFromNotes(n));
});
test('rejects blank choices and invalid or duplicate answers',()=>{
 for(const patch of [{options:['a','','c','d']},{answers:[]},{answers:[4]},{answers:[-1]},{answers:[1,1]}])assert.throws(()=>quizFromNotes(wrap({items:[{...item,...patch}],reason:''})));
});
