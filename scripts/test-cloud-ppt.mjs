// Explicit production smoke test: creates an isolated test lesson and uploads the public sample.
// Never prints teacher tokens, encryption keys or Blob upload tokens.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { put } from '@vercel/blob/client';
import { PDFDocument } from 'pdf-lib';

const base = process.env.TEST_CLASSFLOW_URL ?? 'https://class-flow-fawn.vercel.app';
if (!process.argv.includes('--confirm-upload')) throw new Error('Pass --confirm-upload to create a real test lesson and upload the sample');
const id = `ppt-cloud-check-${Date.now()}`;
const teacherToken = randomUUID();
const headers = { 'x-teacher-token': teacherToken, 'Content-Type': 'application/json' };
async function json(url, body, auth = true) {
  const response = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: auth ? headers : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.ok(response.ok, `HTTP ${response.status}: ${data.error ?? 'request failed'}`);
  return data;
}
await json(`/api/live/${id}`, { action: 'patch', partial: {} });
const bytes = await readFile('yuko-agit-02-claude-prompting.pptx');
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
const endpoint = `/api/conversions?sessionId=${id}`;
const prepared = await json(endpoint, { action: 'prepare', name: 'yuko-agit-02-claude-prompting.pptx', key: key.toString('hex'), iv: iv.toString('hex'), inputBytes: encrypted.length });
await mkdir('.classflow', { recursive: true });
await writeFile('.classflow/cloud-conversion-check.json', JSON.stringify({ sessionId: id, teacherToken, jobId: prepared.id }));
await put(prepared.pathname, encrypted, { access: 'public', contentType: 'application/octet-stream', token: prepared.token, multipart: true });
await json(endpoint, { action: 'submit', id: prepared.id });
console.log('Encrypted PPT uploaded; waiting for Lightsail');
let job;
for (let i = 0; i < 150; i++) {
  job = await json(`${endpoint}&id=${prepared.id}`);
  if (job.status === 'done' || job.status === 'failed') break;
  if (i % 10 === 0) console.log(`Status: ${job.status}`);
  await new Promise(resolve => setTimeout(resolve, 4000));
}
assert.equal(job.status, 'done', job.error ?? 'Conversion did not finish within 10 minutes');
const pdfResponse = await fetch(job.pdfUrl); assert.equal(pdfResponse.status, 200);
const pdf = Buffer.from(await pdfResponse.arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
const pages = (await PDFDocument.load(pdf)).getPageCount(); assert.equal(pages, 41);
const slides = Array.from({ length: pages }, (_, i) => ({ slideNo: i + 1, pdfPage: i + 1, title: `PPT 서버 변환 확인 ${i + 1}`, kind: 'normal', items: [], labNo: null, boardId: null }));
await json(`/api/live/${id}`, { action: 'replaceMaterial', pdfKey: job.pdfUrl, name: '서버 연결 검증.pptx', deck: { sessionId: id, classId: null, slides, source: 'pdf', updatedAt: Date.now() } });
const material = await json(`${endpoint}&material=1`);
const stored = Buffer.from(await (await fetch(material.sourceUrl)).arrayBuffer());
assert.notEqual(stored.subarray(0, 2).toString(), 'PK');
const decipher = createDecipheriv('aes-256-gcm', Buffer.from(material.key, 'hex'), Buffer.from(material.iv, 'hex')); decipher.setAuthTag(stored.subarray(-16));
assert.deepEqual(Buffer.concat([decipher.update(stored.subarray(0, -16)), decipher.final()]), bytes);
assert.equal((await fetch(base + endpoint + '&material=1')).status, 403);
const state = await json(`/api/live/${id}`, undefined, false);
assert.equal(state.session.pdfKey, job.pdfUrl);
const publicJson = JSON.stringify(state);
for (const privateValue of [teacherToken, material.key, material.iv]) assert.equal(publicJson.includes(privateValue), false);
await mkdir('output/cloud-ppt', { recursive: true });
await writeFile('output/cloud-ppt/converted.pdf', pdf);
console.log(JSON.stringify({ result: 'PASS', pages, pdfBytes: pdf.length, originalMatches: true, originalTeacherOnly: true, studentUrl: `${base}/student/${id}` }));
