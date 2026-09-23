import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { extractNotes } from '../lib/lecture/pptxNotes.ts';

const base = 'http://127.0.0.1:3311';
const sessionId = `ppt-local-${Date.now()}`;
const token = randomUUID();
const headers = { 'x-teacher-token': token };
async function command(body) {
  const response = await fetch(`${base}/api/live/${sessionId}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200, await response.clone().text()); return response.json();
}
await command({ action: 'patch', partial: {} });
const bytes = await readFile('yuko-agit-02-claude-prompting.pptx');
const notes = extractNotes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const form = new FormData(); form.append('file', new Blob([bytes]), 'yuko-agit-02-claude-prompting.pptx');
console.log(`Converting ${bytes.length} bytes with ${notes.length} note pages; local only, no AI call`);
const converted = await fetch(`${base}/api/convert?sessionId=${sessionId}`, { method: 'POST', headers, body: form });
assert.equal(converted.status, 200, converted.ok ? '' : await converted.text());
const pdf = await converted.arrayBuffer();
const document = await PDFDocument.load(pdf);
const pages = document.getPageCount();
assert.ok(pages > 0); assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
const save = new FormData(); save.append('pdf', new Blob([pdf], { type: 'application/pdf' }), 'lesson.pdf'); save.append('notes', JSON.stringify(notes));
save.append('original', new Blob([bytes]), 'yuko-agit-02-claude-prompting.pptx');
const saved = await fetch(`${base}/api/local-material?sessionId=${sessionId}`, { method: 'POST', headers, body: save });
assert.equal(saved.status, 200, await saved.clone().text()); const material = await saved.json();
const slides = Array.from({ length: pages }, (_, i) => ({ slideNo: i + 1, title: `변환 확인 ${i + 1}`, kind: 'normal', items: [], labNo: null, boardId: null }));
// 자료 API의 캐시가 교체 직전 상태여도 즉시 새 대본을 반환해야 한다.
const beforeReplace = await fetch(`${base}/api/local-material?sessionId=${sessionId}`, { headers });
assert.equal(beforeReplace.status, 200);
assert.deepEqual((await beforeReplace.json()).notes, []);
await command({ action: 'replaceMaterial', pdfKey: material.url, name: '유코의 아지트 PPT 변환 확인.pptx', deck: { sessionId, classId: null, slides, source: 'pdf', updatedAt: Date.now() } });
const studentPdf = await fetch(base + material.url); assert.equal(studentPdf.status, 200);
assert.deepEqual(Buffer.from(await studentPdf.arrayBuffer()), Buffer.from(pdf));
assert.equal((await fetch(`${base}/api/local-material?sessionId=${sessionId}`)).status, 403);
const teacherNotes = await (await fetch(`${base}/api/local-material?sessionId=${sessionId}`, { headers })).json();
assert.deepEqual(teacherNotes.notes, notes);
const originalUrl = `${base}/api/local-material?sessionId=${sessionId}&download=pptx`;
assert.equal((await fetch(originalUrl)).status, 403);
const original = await fetch(originalUrl, { headers });
assert.equal(original.status, 200);
assert.deepEqual(Buffer.from(await original.arrayBuffer()), bytes);
assert.equal((await fetch(`${base}/api/convert?sessionId=${sessionId}`, { method: 'POST' })).status, 403);
await mkdir('output/local-ppt', { recursive: true }); await writeFile('output/local-ppt/converted.pdf', new Uint8Array(pdf));
console.log(JSON.stringify({ result: 'PASS', pages, pdfBytes: pdf.byteLength, notePages: notes.length, studentUrl: `${base}/student/${sessionId}`, pdfUrl: base + material.url, notesArePrivate: true }));
