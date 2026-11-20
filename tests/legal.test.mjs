import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkConsents, hasCurrentConsent, TERMS_VERSION, PRIVACY_VERSION} from '../lib/legal/documents.ts';

test('checkConsents needs all three boxes', () => {
  assert.deepEqual(checkConsents({age14: true, terms: true, privacy: true}), {ok: true});
  assert.match(checkConsents({terms: true, privacy: true}).message, /14세/);
  assert.match(checkConsents({age14: true, privacy: true}).message, /이용약관/);
  assert.match(checkConsents({age14: true, terms: true}).message, /개인정보/);
  assert.equal(checkConsents({age14: 'true', terms: true, privacy: true}).ok, false);
  assert.equal(checkConsents(null).ok, false);
});

test('hasCurrentConsent compares with the current versions', () => {
  const now = [{kind: 'age14', version: TERMS_VERSION}, {kind: 'terms', version: TERMS_VERSION}, {kind: 'privacy', version: PRIVACY_VERSION}];
  assert.equal(hasCurrentConsent(now), true);
  assert.equal(hasCurrentConsent(now.slice(1)), false);
  assert.equal(hasCurrentConsent(now.map((r) => ({...r, version: 'old'}))), false);
  assert.equal(hasCurrentConsent([]), false);
});

test('withdraw phrase must be typed exactly', async () => {
  const {checkWithdrawPhrase, WITHDRAW_PHRASE} = await import('../lib/profile/withdraw.ts');
  assert.equal(checkWithdrawPhrase(WITHDRAW_PHRASE), true);
  assert.equal(checkWithdrawPhrase(`  ${WITHDRAW_PHRASE} `), true);
  assert.equal(checkWithdrawPhrase('탈퇴'), false);
  assert.equal(checkWithdrawPhrase(null), false);
});
