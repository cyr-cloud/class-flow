import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkNickname, suggestNickname, nicknameSetupPath, normalizeNickname} from '../lib/profile/nickname.ts';
import {verifyCode} from '../lib/auth/service.ts';

test('accepts Korean/English/number nicknames and tidies spaces', () => {
  assert.deepEqual(checkNickname('  코딩하는   곰 '), {ok: true, value: '코딩하는 곰'});
  assert.equal(checkNickname('yuco_92').ok, true);
  assert.equal(checkNickname('a.b-c').ok, true);
});

test('rejects too short, too long, symbols, emoji-only and non-strings', () => {
  for (const bad of ['한', ' a ', 'x'.repeat(21), '<script>', '곰🐻', '...', '', null, 42, {}]) {
    assert.equal(checkNickname(bad).ok, false, String(bad));
  }
});

test('counts Korean characters by code point (20 Korean letters allowed)', () => {
  assert.equal(checkNickname('가'.repeat(20)).ok, true);
  assert.equal(checkNickname('가'.repeat(21)).ok, false);
});

test('blocks names that look like staff, ignoring case and separators', () => {
  for (const bad of ['관리자', '운영자님', 'Admin', 'a.d.m.i.n', '유니크 코딩', 'YuniqCoding팀']) {
    assert.equal(checkNickname(bad).ok, false, bad);
  }
});

test('normalizes decomposed Hangul to NFC', () => {
  assert.equal(normalizeNickname('가'), '가');
});

test('suggests a nickname from social profile, skipping invalid values', () => {
  assert.equal(suggestNickname({nickname: '리베타', name: '최유라'}), '리베타');
  assert.equal(suggestNickname({nickname: '!', name: '최유라'}), '최유라');
  assert.equal(suggestNickname({full_name: 'x'}), '');
  assert.equal(suggestNickname(null), '');
});

test('setup path keeps the original destination encoded', () => {
  assert.equal(nicknameSetupPath('/c/abc?x=1'), '/me/nickname?next=%2Fc%2Fabc%3Fx%3D1');
});

const okProvider = (named) => ({
  async send() { return {error: null}; },
  async verify() { return {error: null, userId: 'u1'}; },
  async hasNickname() { return named; },
  async logout() { return {error: null}; },
});

test('first login (no nickname) is sent to the nickname screen, then back to next', async () => {
  const r = await verifyCode(okProvider(false), {email: 'a@b.co', token: '123456', next: '/c/x'});
  assert.equal(r.status, 200);
  assert.equal(r.body.next, '/me/nickname?next=%2Fc%2Fx');
});

test('returning user with a nickname goes straight to next', async () => {
  const r = await verifyCode(okProvider(true), {email: 'a@b.co', token: '123456', next: '/c/x'});
  assert.equal(r.body.next, '/c/x');
});
