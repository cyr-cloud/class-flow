import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_CLASSES, MAX_RESPONDERS, parseJoined, recordJoin, serializeJoined} from '../lib/live/joined.ts';

const t1 = new Date('2026-11-25T01:00:00Z');
const t2 = new Date('2026-11-25T02:00:00Z');

test('recordJoin adds a new class and updates an existing one to the front', () => {
  let list = recordJoin([], {code: 'abc123', title: '1회차', responderId: 'r_1', now: t1});
  list = recordJoin(list, {code: 'zzz999', title: '다른 수업', responderId: 'r_9', now: t1});
  list = recordJoin(list, {code: 'abc123', title: '', responderId: 'r_2', name: '유라', now: t2});
  assert.equal(list.length, 2);
  assert.equal(list[0].code, 'abc123');
  assert.equal(list[0].title, '1회차'); // 빈 제목은 이전 값 유지
  assert.equal(list[0].firstAt, t1.toISOString());
  assert.equal(list[0].lastAt, t2.toISOString());
  assert.deepEqual(list[0].responderIds, ['r_1', 'r_2']);
  assert.equal(list[0].name, '유라');
});

test('recordJoin ignores empty code or responder and caps sizes', () => {
  assert.deepEqual(recordJoin([], {code: ' ', title: 'x', responderId: 'r', now: t1}), []);
  assert.deepEqual(recordJoin([], {code: 'a', title: 'x', responderId: '', now: t1}), []);
  let list = [];
  for (let i = 0; i < MAX_CLASSES + 5; i++) list = recordJoin(list, {code: `c${i}`, title: '', responderId: 'r', now: t1});
  assert.equal(list.length, MAX_CLASSES);
  assert.equal(list[0].code, `c${MAX_CLASSES + 4}`);
  let one = [];
  for (let i = 0; i < MAX_RESPONDERS + 3; i++) one = recordJoin(one, {code: 'a', title: '', responderId: `r${i}`, now: t1});
  assert.equal(one[0].responderIds.length, MAX_RESPONDERS);
  assert.equal(one[0].responderIds.at(-1), `r${MAX_RESPONDERS + 2}`);
});

test('parseJoined round-trips and drops broken data', () => {
  const list = recordJoin([], {code: 'abc123', title: '1회차', responderId: 'r_1', now: t1});
  assert.deepEqual(parseJoined(serializeJoined(list)), list);
  assert.deepEqual(parseJoined(null), []);
  assert.deepEqual(parseJoined('not json'), []);
  assert.deepEqual(parseJoined(JSON.stringify({classes: [{code: 1}, null, {code: 'ok', title: 't', firstAt: 'a', lastAt: 'b', responderIds: ['r', 5]}]})),
    [{code: 'ok', title: 't', firstAt: 'a', lastAt: 'b', responderIds: ['r']}]);
});
