import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { mergeLessonPdf } from '../lib/lecture/mergeLessonPdf.ts';

test('exports inserted pages in sequence and preserves original page dimensions', async () => {
  const source = await PDFDocument.create(); source.addPage([300, 200]); source.addPage([400, 250]);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9uoAAAAASUVORK5CYII=', 'base64');
  const seen = [];
  const bytes = await mergeLessonPdf((await source.save()).buffer, [
    { slideNo: 1, pdfPage: 1 }, { slideNo: 2, content: { id: 'cloud', type: 'wordcloud' } },
    { slideNo: 3, content: { id: 'image', type: 'image' } }, { slideNo: 4, pdfPage: 2 },
  ], async slide => { seen.push(slide.content.id); return png; });
  const result = await PDFDocument.load(bytes);
  assert.deepEqual(seen, ['cloud', 'image']);
  assert.equal(result.getPageCount(), 4);
  assert.deepEqual(result.getPages().map(p => [p.getWidth(), p.getHeight()]), [[300, 200], [960, 540], [960, 540], [400, 250]]);
});

test('rejects a broken original page reference instead of exporting the wrong page', async () => {
  const source = await PDFDocument.create(); source.addPage();
  const bytes = await source.save();
  await assert.rejects(() => mergeLessonPdf(bytes.buffer, [{ slideNo: 3 }], async () => new Uint8Array()), /원본 PDF/);
});

test('keeps all continuation pages of long survey responses before next original slide', async () => {
 const source=await PDFDocument.create(); source.addPage([300,200]);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9uoAAAAASUVORK5CYII=','base64');
 const bytes=await mergeLessonPdf((await source.save()).buffer,[{slideNo:1,content:{id:'cards',type:'survey'}},{slideNo:2,pdfPage:1}],async()=>[png,png,png]);
 const result=await PDFDocument.load(bytes);
 assert.equal(result.getPageCount(),4);
 assert.deepEqual(result.getPages().map(p=>p.getWidth()),[960,960,960,300]);
});
