import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, webcrypto, createDecipheriv } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const values = new Map(); let writes = 0; let now = Date.now();
  const storage = {
    async get(k) { return values.get(k) ?? null; },
    async compareAndSet(k, old, next) { if ((values.get(k) ?? null) !== old) return false; values.set(k, next); writes++; return true; },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../lib/conversion/queue.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'node:crypto' ? { randomUUID } : { kv: () => storage }, process: { env: {} } });
  return { q: new exports.ConversionQueue(storage, () => now), exports, advance: ms => { now += ms; }, writes: () => writes };
}
const prepare = (q, session = 'teacher') => q.prepare(session, 'lesson.pptx', 'a'.repeat(64), 'b'.repeat(24), 100);
test('concurrent claims yield one job; wrong lease cannot complete; report is idempotent', async () => {
  const { q } = fixture(); const job = await prepare(q);
  await q.enqueue(job.id, 'https://example.public.blob.vercel-storage.com/source.bin');
  const claims = await Promise.all(Array.from({ length: 8 }, () => q.claim()));
  const active = claims.filter(Boolean); assert.equal(active.length, 1);
  await assert.rejects(q.complete(job.id, 'wrong', { pdfUrl: 'bad' }));
  await q.complete(job.id, active[0].lease, { pdfUrl: 'https://pdf' });
  await q.complete(job.id, active[0].lease, { error: 'late retry' });
  assert.equal((await q.get(job.id)).status, 'done');
  assert.equal(await q.material('other', 'https://pdf'), null);
  assert.equal((await q.material('teacher', 'https://pdf')).id, job.id);
});
test('dead worker lease expires and late success cannot overwrite failure', async () => {
  const { q, advance } = fixture(); const job = await prepare(q);
  await q.enqueue(job.id, 'https://source'); const claim = await q.claim();
  advance(10 * 60_000 + 1);
  await q.complete(job.id, claim.lease, { pdfUrl: 'https://late' });
  assert.equal((await q.get(job.id)).status, 'failed');
  assert.equal((await q.get(job.id)).pdfUrl, undefined);
});
test('per-session exclusion, upload cancellation and storage quota persist', async () => {
  const { q } = fixture();
  const first = await prepare(q);
  await assert.rejects(prepare(q)); await q.cancelUpload(first.id);
  for (let i = 1; i < 8; i++) { const j = await prepare(q); await q.cancelUpload(j.id); }
  await assert.rejects(prepare(q));
});
test('unchanged idle polls do not write, teacher-visible status omits encryption keys', async () => {
  const { q, writes, exports } = fixture(); const job = await prepare(q);
  const before = writes(); await q.get(job.id); await q.claim(); assert.equal(writes(), before);
  const visible = exports.publicJob(job);
  for (const key of ['key', 'iv', 'lease', 'sourceUrl']) assert.equal(key in visible, false);
});
test('browser AES-GCM ciphertext decrypts in the worker and rejects tampering', async () => {
  const key = webcrypto.getRandomValues(new Uint8Array(32)); const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const imported = await webcrypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
  const encrypted = Buffer.from(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, imported, Buffer.from('private speaker notes')));
  const decrypt = data => { const cipher = createDecipheriv('aes-256-gcm', key, iv); cipher.setAuthTag(data.subarray(-16)); return Buffer.concat([cipher.update(data.subarray(0, -16)), cipher.final()]); };
  assert.equal(decrypt(encrypted).toString(), 'private speaker notes');
  encrypted[0] ^= 1; assert.throws(() => decrypt(encrypted));
});
