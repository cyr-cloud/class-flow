import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// HeaderAccount.tsx는 JSX라 바로 불러올 수 없어서, 주소 규칙만 꺼내 확인한다.
const source = readFileSync(new URL('../components/HeaderAccount.tsx', import.meta.url), 'utf8');
const rule = (name) => new RegExp(source.match(new RegExp(`const ${name} = \/(.+)\/;`))[1]);
const hidden = rule('HIDDEN');
const inClass = rule('IN_CLASS');

test('account button shows everywhere except login screens', () => {
  for (const p of ['/login', '/auth/callback']) assert.equal(hidden.test(p), true, p);
  for (const p of ['/', '/teacher/abc123', '/student/abc123', '/courses/x/1', '/me', '/admin', '/terms', '/board', '/logins']) assert.equal(hidden.test(p), false, p);
});

test('only the student class screen opens account pages in a new tab', () => {
  assert.equal(inClass.test('/student/abc123'), true);
  for (const p of ['/', '/teacher/abc123', '/students', '/courses/x/1']) assert.equal(inClass.test(p), false, p);
});
