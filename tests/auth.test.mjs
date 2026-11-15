import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath, DEFAULT_RETURN_PATH} from '../lib/auth/input.ts';
import {requestCode, verifyCode} from '../lib/auth/service.ts';

test('safeReturnPath keeps same-site lesson paths', () => {
  assert.equal(safeReturnPath('/courses/dopamine-python/03/new'), '/courses/dopamine-python/03/new');
  assert.equal(safeReturnPath('/me?tab=posts#top'), '/me?tab=posts#top');
});

test('safeReturnPath rejects external, protocol-relative and encoded tricks', () => {
  for (const bad of [undefined, null, 42, '', 'https://evil.example', '//evil.example', '/\\evil.example',
    '/%2f%2fevil.example', '/%5cevil', '/a%0d%0aSet-Cookie:x', 'javascript:alert(1)', '/api/auth/logout', '/login?next=/me', '/auth/callback']) {
    assert.equal(safeReturnPath(bad), DEFAULT_RETURN_PATH, String(bad));
  }
});

function fakeProvider(overrides = {}) {
  const calls = [];
  return {
    calls,
    async send(email, next) { calls.push(['send', email, next]); return {error: overrides.sendError ?? null}; },
    async verify(email, token) { calls.push(['verify', email, token]); return overrides.verify ?? {error: null, userId: 'u1'}; },
    async logout() { return {error: null}; },
  };
}

test('requestCode validates email and passes a safe return path', async () => {
  const p = fakeProvider();
  assert.equal((await requestCode(p, 'not-an-email', '/me')).status, 400);
  assert.equal(p.calls.length, 0);
  const ok = await requestCode(p, '  Student@Example.com ', 'https://evil.example');
  assert.equal(ok.status, 200);
  assert.deepEqual(p.calls[0], ['send', 'student@example.com', DEFAULT_RETURN_PATH]);
});

test('requestCode maps provider errors without leaking details', async () => {
  assert.equal((await requestCode(fakeProvider({sendError: {status: 429}}), 'a@b.co', '/')).status, 429);
  assert.equal((await requestCode(fakeProvider({sendError: {status: 500, code: 'x'}}), 'a@b.co', '/')).status, 503);
});

test('verifyCode checks code format, returns next only on success', async () => {
  assert.equal((await verifyCode(fakeProvider(), {email: 'a@b.co', token: '12ab'})).status, 400);
  const bad = await verifyCode(fakeProvider({verify: {error: {status: 400}, userId: null}}), {email: 'a@b.co', token: '123456'});
  assert.equal(bad.status, 400);
  assert.equal(bad.body.next, undefined);
  const ok = await verifyCode(fakeProvider(), {email: 'a@b.co', token: '123456', next: '/courses/x/1/new'});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.next, '/courses/x/1/new');
});
