import test from 'node:test';
import assert from 'node:assert/strict';
import {assignWordColors,WORD_COLORS} from '../lib/lecture/wordCloudColors.ts';

const rows = words => words.map(word => ({ word }));

test('팔레트 수만큼의 단어는 색이 하나도 겹치지 않는다', () => {
  const words = Array.from({ length: WORD_COLORS.length }, (_, i) => `단어${i}`);
  const colorOf = assignWordColors(rows(words));
  assert.equal(new Set(words.map(colorOf)).size, WORD_COLORS.length);
});

test('같은 단어가 더 들어와도, 새 단어가 뒤에 붙어도 기존 색은 그대로다', () => {
  const first = ['재미', '신기', '유익'];
  const before = first.map(assignWordColors(rows(first)));
  const after = first.map(assignWordColors(rows([...first, '재미', '재미', '편리', '도전'])));
  assert.deepEqual(after, before);
});

test('대소문자만 다른 단어는 같은 색이다', () => {
  const colorOf = assignWordColors(rows(['Claude', 'claude']));
  assert.equal(colorOf('CLAUDE'), colorOf('claude'));
});

test('팔레트보다 단어가 많으면 한 바퀴 돌아 다시 쓴다', () => {
  const words = Array.from({ length: WORD_COLORS.length * 2 }, (_, i) => `w${i}`);
  const colorOf = assignWordColors(rows(words));
  const counts = new Map();
  for (const w of words) counts.set(colorOf(w), (counts.get(colorOf(w)) ?? 0) + 1);
  assert.deepEqual([...counts.values()], Array(WORD_COLORS.length).fill(2));
});
