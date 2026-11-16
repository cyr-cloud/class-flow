import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCourseInput, parseLessonInput, optionalHttpsUrl, suggestSlug, neighborLesson, nextLessonNumber} from '../lib/course/model.ts';

const base = {slug: 'python-basic', title: '  도파민   Python ', description: '소개\r\n둘째 줄', channel: 'youtube', visibility: 'draft', cover_url: '', external_url: 'https://www.youtube.com/playlist?list=abc'};

test('accepts a valid course and tidies text', () => {
  const r = parseCourseInput(base);
  assert.equal(r.ok, true);
  assert.equal(r.value.title, '도파민 Python');
  assert.equal(r.value.description, '소개\n둘째 줄');
  assert.equal(r.value.cover_url, null);
});

test('rejects bad slug, unknown channel/visibility and non-https links', () => {
  const r = parseCourseInput({...base, slug: 'Python Basic', channel: 'tiktok', visibility: 'secret', external_url: 'javascript:alert(1)', cover_url: 'http://a.com/x.png'});
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['channel', 'cover_url', 'external_url', 'slug', 'visibility']);
});

test('slug is lowercased; leading/trailing or double hyphens rejected', () => {
  assert.equal(parseCourseInput({...base, slug: 'PY-01'}).value.slug, 'py-01');
  for (const bad of ['-py', 'py-', 'py--01', 'a', 'py_01']) assert.equal(parseCourseInput({...base, slug: bad}).ok, false, bad);
});

test('https url helper: empty → null, only https with a host', () => {
  assert.deepEqual(optionalHttpsUrl('  '), {ok: true, value: null});
  assert.equal(optionalHttpsUrl('https://inflearn.com/course/x').ok, true);
  for (const bad of ['http://x.com', 'https://localhost', 'ftp://x.com', 'data:text/html,hi', 'https://' + 'a'.repeat(500) + '.com']) assert.equal(optionalHttpsUrl(bad).ok, false, bad);
});

test('lesson input: title required, short code format, guide length', () => {
  assert.deepEqual(parseLessonInput({title: '변수', guide_md: '## 안내', short_code: 'PY01', example_image_url: ''}), {ok: true, value: {title: '변수', guide_md: '## 안내', short_code: 'py01', example_image_url: null}});
  const r = parseLessonInput({title: '', short_code: 'p!', guide_md: 'x'.repeat(20001)});
  assert.deepEqual(Object.keys(r.errors).sort(), ['guide_md', 'short_code', 'title']);
});

test('suggests a slug from English titles, empty for Korean-only', () => {
  assert.equal(suggestSlug('Dopamine Python 101!'), 'dopamine-python-101');
  assert.equal(suggestSlug('도파민 파이썬'), '');
});

test('neighbor lesson and next number for reordering', () => {
  const ls = [{id: 'b', number: 2}, {id: 'a', number: 1}, {id: 'c', number: 5}];
  assert.equal(neighborLesson(ls, 'b', 'up').id, 'a');
  assert.equal(neighborLesson(ls, 'b', 'down').id, 'c');
  assert.equal(neighborLesson(ls, 'a', 'up'), null);
  assert.equal(neighborLesson(ls, 'zzz', 'up'), null);
  assert.equal(nextLessonNumber(ls), 6);
  assert.equal(nextLessonNumber([]), 1);
});

import {courseShareUrl, cleanAccessKey, VISIBILITIES} from '../lib/course/model.ts';

test('share link: none for draft, plain for public, with key for unlisted', () => {
  const c = {slug: 'py', access_key: 'abcd1234abcd1234'};
  assert.equal(courseShareUrl('https://class.example', {...c, visibility: 'draft'}), null);
  assert.equal(courseShareUrl('https://class.example', {...c, visibility: 'public'}), 'https://class.example/courses/py');
  assert.equal(courseShareUrl('https://class.example', {...c, visibility: 'unlisted'}), 'https://class.example/courses/py?key=abcd1234abcd1234');
});

test('access key filter and unlisted visibility accepted', () => {
  assert.equal(cleanAccessKey('abcd1234abcd1234'), 'abcd1234abcd1234');
  for (const bad of ['short', 'ABCD1234ABCD1234', "x' or '1'='1abcdef", null]) assert.equal(cleanAccessKey(bad), null);
  assert.ok('unlisted' in VISIBILITIES);
  assert.equal(parseCourseInput({...base, visibility: 'unlisted'}).ok, true);
});
