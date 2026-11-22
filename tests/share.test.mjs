import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plainSummary, pickShareImage, shareMetadata, siteBase, DEFAULT_SHARE_IMAGE} from '../lib/share/meta.ts';

test('plainSummary strips markdown and trims to length', () => {
  assert.equal(plainSummary('## 목표\n- **변수**로 `name` 만들기\n![예시](https://x/y.png)\n[문서](https://d)'), '목표 변수로 name 만들기 문서');
  assert.equal(plainSummary('```py\nprint(1)\n```\n코드 아래 설명'), '코드 아래 설명');
  assert.equal(plainSummary(null), '');
  const long = plainSummary('가'.repeat(200), 20);
  assert.equal(long.length, 20);
  assert.ok(long.endsWith('…'));
});

test('pickShareImage takes the first https or site path, else default', () => {
  assert.equal(pickShareImage(null, '', 'http://insecure/a.png', 'https://ok/a.png'), 'https://ok/a.png');
  assert.equal(pickShareImage(undefined, '/cover.png'), '/cover.png');
  assert.equal(pickShareImage(null, 'javascript:alert(1)'), DEFAULT_SHARE_IMAGE.url);
});

test('shareMetadata fills og/twitter fully and hides non-public pages from search', () => {
  const m = shareMetadata({title: '1차시 변수 — ClassFlow', shareTitle: '1차시 변수', description: '설명', path: '/courses/a/1?key=k', image: 'https://img/a.webp', imageAlt: '결과물', index: false});
  assert.equal(m.openGraph.siteName, 'ClassFlow');
  assert.equal(m.openGraph.title, '1차시 변수');
  assert.equal(m.openGraph.url, '/courses/a/1?key=k');
  assert.deepEqual(m.openGraph.images, [{url: 'https://img/a.webp', alt: '결과물'}]);
  assert.equal(m.twitter.card, 'summary_large_image');
  assert.deepEqual(m.robots, {index: false, follow: false});
  const pub = shareMetadata({title: 't', description: '', path: '/x', image: DEFAULT_SHARE_IMAGE.url, imageAlt: 'a', index: true});
  assert.equal(pub.robots, undefined);
  assert.equal(pub.description, undefined);
  assert.equal(pub.openGraph.images[0].width, DEFAULT_SHARE_IMAGE.width);
});

test('siteBase falls back when env is missing or broken', () => {
  assert.equal(siteBase('https://class.yuniq-coding.shop').origin, 'https://class.yuniq-coding.shop');
  assert.equal(siteBase(undefined).origin, 'https://class-flow-fawn.vercel.app');
  assert.equal(siteBase('not a url').origin, 'https://class-flow-fawn.vercel.app');
});
