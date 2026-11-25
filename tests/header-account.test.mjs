import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// HeaderAccount.tsx는 JSX라 바로 불러올 수 없어서, 숨기는 주소 규칙만 꺼내 확인한다.
const source = readFileSync(new URL('../components/HeaderAccount.tsx', import.meta.url), 'utf8');
const pattern = new RegExp(source.match(/const HIDDEN = \/(.+)\/;/)[1]);

test('account button hides on live class and login screens only', () => {
  for (const p of ['/teacher/abc123', '/student/abc123', '/login', '/auth/callback']) assert.equal(pattern.test(p), true, p);
  for (const p of ['/', '/courses/x/1', '/me', '/admin', '/terms', '/board', '/teachers', '/studentx']) assert.equal(pattern.test(p), false, p);
});
