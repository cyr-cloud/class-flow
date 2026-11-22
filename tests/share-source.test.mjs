import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectSource, isBotAgent} from '../lib/share/source.ts';
import {shortLinkPath, shortLinkUrl} from '../lib/course/model.ts';

test('detectSource prefers ?from, then referer host, else other', () => {
  assert.equal(detectSource('yt', null), 'youtube');
  assert.equal(detectSource('INF', null), 'inflearn');
  assert.equal(detectSource(['qr', 'yt'], null), 'qr');
  assert.equal(detectSource('nope', 'https://www.youtube.com/watch?v=x'), 'youtube');
  assert.equal(detectSource(undefined, 'https://youtu.be/x'), 'youtube');
  assert.equal(detectSource(undefined, 'https://www.inflearn.com/course/x'), 'inflearn');
  assert.equal(detectSource(undefined, 'https://evil-youtube.com.example/'), 'other');
  assert.equal(detectSource(undefined, 'not a url'), 'other');
  assert.equal(detectSource(undefined, null), 'other');
});

test('isBotAgent skips preview crawlers and empty agents', () => {
  assert.equal(isBotAgent(null), true);
  assert.equal(isBotAgent('facebookexternalhit/1.1'), true);
  assert.equal(isBotAgent('Mozilla/5.0 (compatible; kakaotalk-scrap/1.0)'), true);
  assert.equal(isBotAgent('curl/8.0'), true);
  assert.equal(isBotAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK 10.4.0'), false);
  assert.equal(isBotAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36'), false);
});

test('short links carry key and source together', () => {
  assert.equal(shortLinkPath('py03', null, 'yt'), '/p/py03?from=yt');
  assert.equal(shortLinkPath('py03', 'abc', 'qr'), '/p/py03?key=abc&from=qr');
  assert.equal(shortLinkUrl('https://x.shop', 'py03', {visibility: 'public', access_key: 'k'}, 'inf'), 'https://x.shop/p/py03?from=inf');
});
