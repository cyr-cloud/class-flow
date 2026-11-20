import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectImageType, isOwnImagePath, parsePostInput, galleryImageUrl} from '../lib/gallery/model.ts';

const uid = '22222222-2222-4222-8222-222222222222';
const other = '88888888-8888-4888-8888-888888888888';
const img = (n, owner = uid) => `${owner}/0b9a4c1e-1111-4222-8333-00000000000${n}.webp`;

test('detectImageType reads the real format from the first bytes', () => {
  assert.equal(detectImageType(new Uint8Array([0x52,0x49,0x46,0x46,1,2,3,4,0x57,0x45,0x42,0x50])), 'webp');
  assert.equal(detectImageType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0])), 'png');
  assert.equal(detectImageType(new Uint8Array([0xff,0xd8,0xff,0xe0])), 'jpg');
  assert.equal(detectImageType(new TextEncoder().encode('GIF89a......')), null);
  assert.equal(detectImageType(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  assert.equal(detectImageType(new Uint8Array([])), null);
});

test('isOwnImagePath accepts only the uploader folder and the stored name shape', () => {
  assert.equal(isOwnImagePath(img(1), uid), true);
  assert.equal(isOwnImagePath(img(1, other), uid), false);
  assert.equal(isOwnImagePath(`${uid}/../../x.webp`, uid), false);
  assert.equal(isOwnImagePath(`${uid}/abc.gif`, uid), false);
  assert.equal(isOwnImagePath(42, uid), false);
});

test('parsePostInput tidies text and checks limits', () => {
  const r = parsePostInput({title: '  나만의   캐릭터 ', body: '첫 줄\r\n둘째 줄 ', images: [img(1)]}, uid);
  assert.equal(r.ok, true);
  assert.equal(r.value.title, '나만의 캐릭터');
  assert.equal(r.value.body, '첫 줄\n둘째 줄');
  const bad = parsePostInput({title: '가'.repeat(41), body: '나'.repeat(501), images: []}, uid);
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['body', 'images', 'title']);
  assert.equal(parsePostInput({title: 'x', images: [1,2,3,4,5].map((n) => img(n))}, uid).ok, false);
  assert.equal(parsePostInput({title: 'x', images: [img(1), img(1)]}, uid).ok, false);
  assert.equal(parsePostInput({title: 'x', images: [img(1, other)]}, uid).ok, false);
});

test('galleryImageUrl builds the public storage address', () => {
  assert.equal(galleryImageUrl('https://abc.supabase.co/', `${uid}/a.webp`), `https://abc.supabase.co/storage/v1/object/public/gallery/${uid}/a.webp`);
});

test('parseLink adds https, refuses http and odd schemes', async () => {
  const {parseLink, linkLabel} = await import('../lib/gallery/model.ts');
  assert.deepEqual(parseLink('github.com/yuco/rpg'), {ok: true, value: 'https://github.com/yuco/rpg'});
  assert.deepEqual(parseLink(' https://yuco-demo.vercel.app '), {ok: true, value: 'https://yuco-demo.vercel.app/'});
  for (const bad of ['http://a.com', 'javascript:alert(1)', 'data:text/html,x', 'localhost:3000', 'https://user:pw@a.com', '그냥 글자', '', 'https://a.com/' + 'x'.repeat(500)]) {
    assert.equal(parseLink(bad).ok, false, bad);
  }
  assert.equal(linkLabel('https://www.github.com/yuco/rpg/'), 'github.com/yuco/rpg');
});

test('parsePostInput: image or link required, up to 3 links, duplicates merged', async () => {
  const {parsePostInput} = await import('../lib/gallery/model.ts');
  const ok = parsePostInput({title: '배포했어요', links: ['yuco.vercel.app', 'https://yuco.vercel.app/', '']}, uid);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value.links, ['https://yuco.vercel.app/']);
  assert.equal(parsePostInput({title: 'x'}, uid).ok, false);
  assert.equal(parsePostInput({title: 'x', links: ['a.com', 'b.com', 'c.com', 'd.com']}, uid).ok, false);
  const bad = parsePostInput({title: 'x', links: ['a.com', 'http://b.com']}, uid);
  assert.equal(bad.ok, false);
  assert.match(bad.errors['links.1'], /https/);
});
