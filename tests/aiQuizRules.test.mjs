import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAiQuizzes } from '../lib/lecture/aiQuizRules.ts';

const quiz = (overrides = {}) => ({ quizType: 'blank', question: '빈칸 ______에 들어갈 값은?',
  options: ['가나다', '라마바', '사아자', '차카타'], answers: [1], ...overrides });
const check = (item) => validateAiQuizzes([item], [], 3);

test('accepts four choices and explicit OX; rejects three choices and arbitrary binary questions', () => {
  assert.deepEqual(check(quiz()).issues, []);
  assert.deepEqual(check(quiz({ quizType: 'ox', options: ['O', 'X'], answers: [0] })).issues, []);
  assert.ok(check(quiz({ options: ['A', 'B', 'C'] })).issues.length);
  assert.ok(check(quiz({ options: ['예', '아니오'] })).issues.length);
});
test('does not silently drop blank choices and shift the correct answer', () => {
  const result = check(quiz({ options: ['가', '', '나', '다'], answers: [2] }));
  assert.ok(result.issues.length);
  assert.equal(result.items[0].options[2], '나');
  assert.deepEqual(result.items[0].answers, [2]);
});
test('rejects absent, out of range, repeated, and all-correct answers', () => {
  for (const answers of [[], [-1], [4], [1, 1], [0, 1, 2, 3]]) {
    assert.ok(check(quiz({ answers })).issues.length, JSON.stringify(answers));
  }
});
test('rejects duplicate choices and conspicuously longer correct choices', () => {
  assert.ok(check(quiz({ options: ['가', '가', '나', '다'] })).issues.length);
  assert.ok(check(quiz({ options: ['가', '정답만 상세하게 설명한 긴 문장', '나', '다'] })).issues.length);
  assert.deepEqual(check(quiz({ answers: [0, 2] })).issues, []);
});
test('checks new item against existing quiz answer and type runs', () => {
  const history = [quiz({ slideNo: 1 }), quiz({ slideNo: 2 })];
  const issues = validateAiQuizzes([quiz()], history, 3).issues;
  assert.ok(issues.some(s => s.includes('정답 번호')));
  assert.ok(issues.some(s => s.includes('같은 유형')));
  assert.deepEqual(validateAiQuizzes([quiz({ answers: [0], quizType: 'matching' })], history, 3).issues, []);
});
test('checks the following slide too without retroactively rejecting old violations', () => {
  const history = [quiz({ slideNo: 1 }), quiz({ slideNo: 2 }), quiz({ slideNo: 4 })];
  assert.ok(validateAiQuizzes([quiz()], history, 2).issues.length);
  assert.deepEqual(validateAiQuizzes([], history, 2).issues, []);
  assert.deepEqual(validateAiQuizzes([quiz({ answers: [0], quizType: 'matching' })], history, 5).issues, []);
});
test('rejects answer length blanks, fenced blocks, and redundant option numbers', () => {
  for (const question of ['빈칸 ○○는?', '```python\nx\n```', '도구에 대한 설명으로 맞는 것은?']) {
    assert.ok(check(quiz({ question })).issues.length);
  }
  assert.ok(check(quiz({ options: ['① 가', '② 나', '③ 다', '④ 라'] })).issues.length);
});
