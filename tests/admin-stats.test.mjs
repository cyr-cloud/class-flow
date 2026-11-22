import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupByCourse, sumRecent, barPercent} from '../lib/admin/stats.ts';

const row = (course, n, visible, hidden = 0, week = 0) => ({
  course_id: course, course_slug: course, course_title: course.toUpperCase(), course_visibility: 'draft',
  lesson_id: `${course}-${n}`, lesson_number: n, lesson_title: `차시 ${n}`,
  visible_posts: visible, hidden_posts: hidden, week_posts: week, authors: visible, last_post_at: null,
});

test('groupByCourse keeps order and sums per course', () => {
  const g = groupByCourse([row('b', 1, 2, 1, 1), row('b', 2, 5), row('b', 3, 0), row('a', 1, 0)]);
  assert.deepEqual(g.map((c) => c.id), ['b', 'a']);
  assert.equal(g[0].visible, 7);
  assert.equal(g[0].hidden, 1);
  assert.equal(g[0].week, 1);
  assert.equal(g[0].emptyLessons, 1);
  assert.equal(g[0].topLesson, 2);
  assert.equal(g[1].topLesson, null);
  assert.equal(g[1].emptyLessons, 1);
});

test('topLesson picks the earlier lesson on ties', () => {
  assert.equal(groupByCourse([row('c', 1, 3), row('c', 2, 3)])[0].topLesson, 1);
});

test('sumRecent adds the newest n days', () => {
  const days = [{day: '2026-11-22', classflow: 2, accounts: 3}, {day: '2026-11-21', classflow: 1, accounts: 1}, {day: '2026-11-20', classflow: 4, accounts: 4}];
  assert.equal(sumRecent(days, 1), 2);
  assert.equal(sumRecent(days, 2), 3);
  assert.equal(sumRecent(days, 30), 7);
  assert.equal(sumRecent(days, 2, 'accounts'), 4);
  assert.equal(sumRecent(days, -1), 0);
});

test('barPercent scales to max with a visible minimum', () => {
  assert.equal(barPercent(0, 5), 0);
  assert.equal(barPercent(5, 5), 100);
  assert.equal(barPercent(1, 100), 4);
  assert.equal(barPercent(3, 0), 0);
});
