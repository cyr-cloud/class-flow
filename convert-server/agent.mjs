// Outbound-only worker. Needs only a job API secret, never the Blob/Redis master tokens.
import { createDecipheriv } from 'node:crypto';
import { mkdtemp, open, stat, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { put } from '@vercel/blob/client';

const base = process.env.CLASSFLOW_URL;
const secret = process.env.CONVERSION_WORKER_SECRET;
if (!base?.startsWith('https://') || !secret) throw new Error('Configure HTTPS CLASSFLOW_URL and worker secret');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(body) {
  const r = await fetch(`${base}/api/conversions/worker`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Job API ${r.status}`);
  return r.json();
}
async function bounded(response, limit) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > limit) throw new Error('File too large');
  const chunks = []; let total = 0;
  for await (const part of response.body) {
    total += part.length;
    if (total > limit) throw new Error('File too large');
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}
async function convert(job) {
  const url = new URL(job.sourceUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')) throw new Error('Invalid Blob source');
  const folder = await mkdtemp(path.join(tmpdir(), 'classflow-agent-'));
  try {
    const source = path.join(folder, 'source.bin'); const ppt = path.join(folder, 'deck.pptx');
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Blob ${response.status}`);
    let total = 0;
    await pipeline(response.body, new Transform({ transform(chunk, _encoding, callback) {
      total += chunk.length; callback(total > 200 * 1024 * 1024 + 16 ? new Error('File too large') : null, chunk);
    } }), createWriteStream(source, { mode: 0o600 }));
    if (total <= 16) throw new Error('Invalid encrypted source');
    const file = await open(source, 'r'); const tag = Buffer.alloc(16);
    try { await file.read(tag, 0, 16, total - 16); } finally { await file.close(); }
    const cipher = createDecipheriv('aes-256-gcm', Buffer.from(job.key, 'hex'), Buffer.from(job.iv, 'hex')); cipher.setAuthTag(tag);
    await pipeline(createReadStream(source, { end: total - 17 }), cipher, createWriteStream(ppt, { mode: 0o600 }));
    const pdf = await bounded(await fetch('http://127.0.0.1:8090/convert', { method: 'POST', headers: { 'Content-Length': String((await stat(ppt)).size) }, body: createReadStream(ppt), duplex: 'half', signal: AbortSignal.timeout(210000) }), 60 * 1024 * 1024);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF');
    await put(job.pdfPath, pdf, { token: job.uploadToken, access: 'public', contentType: 'application/pdf', multipart: true });
  } finally { await rm(folder, { recursive: true, force: true }); }
}
for (;;) {
  try {
    const { job } = await api({ action: 'claim' });
    if (!job) { await wait(30000); continue; }
    let failed = false;
    try { await convert(job); } catch (error) { failed = true; console.error('Conversion failed:', error.message); }
    // Retry reporting, not conversion: avoids duplicate large uploads on transient failures.
    for (let attempt = 0; attempt < 5; attempt++) {
      try { await api({ action: 'complete', id: job.id, lease: job.lease, failed }); break; }
      catch (error) { if (attempt === 4) throw error; await wait(5000); }
    }
    console.log(`Conversion ${failed ? 'failed' : 'completed'}`);
  } catch (error) { console.error(error.message); await wait(30000); }
}
