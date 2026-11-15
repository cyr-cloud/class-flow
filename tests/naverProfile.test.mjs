import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapNaverProfile} from '../supabase/functions/naver-userinfo/map.ts';

test('maps a Naver profile to standard userinfo keyed on the Naver id', () => {
  const info = mapNaverProfile({resultcode: '00', message: 'success', response: {
    id: 'naver-123', email: ' Yuco@Naver.com ', name: '유코', nickname: 'yuco', profile_image: 'https://phinf.pstatic.net/a.jpg'}});
  assert.deepEqual(info, {sub: 'naver-123', email: 'yuco@naver.com', email_verified: false, name: '유코', nickname: 'yuco', picture: 'https://phinf.pstatic.net/a.jpg'});
});

test('never marks the Naver email as verified (no auto-linking to other accounts)', () => {
  assert.equal(mapNaverProfile({resultcode: '00', response: {id: 'x', email: 'a@b.co'}}).email_verified, false);
});

test('falls back to nickname and drops empty or non-https values', () => {
  const info = mapNaverProfile({resultcode: '00', response: {id: 'x', name: '  ', nickname: '닉', profile_image: 'http://insecure/a.jpg', email: ''}});
  assert.equal(info.name, '닉');
  assert.equal(info.picture, undefined);
  assert.equal(info.email, undefined);
});

test('rejects failed or malformed responses', () => {
  for (const bad of [null, {}, {resultcode: '024', message: 'Authentication failed'}, {resultcode: '00'}, {resultcode: '00', response: {email: 'a@b.co'}}]) {
    assert.equal(mapNaverProfile(bad), null);
  }
});
