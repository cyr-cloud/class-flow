// Read public Blob metadata, then CAS-update byte accounting only. Never deletes files.
// node --env-file=.env scripts/reconcile-conversion-sizes.mjs [--apply]
const apply = process.argv.includes('--apply');
async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw Error('Redis operation failed');
  return body.result;
}
async function size(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.public.blob.vercel-storage.com')) throw Error('Unexpected storage host');
  const response = await fetch(url, { headers: { Range: 'bytes=0-0', 'Accept-Encoding': 'identity' }, redirect: 'error' });
  const length = response.status === 206 ? response.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] : response.headers.get('content-length');
  await response.body?.cancel();
  if (!response.ok || !length || !/^\d+$/.test(length)) throw Error(`Cannot verify stored size: HTTP ${response.status}, length=${length}`);
  return Number(length);
}
const key = 'conversion:queue:v1';
const raw = await redis(['GET', key]);
const initial = raw ? JSON.parse(raw) : { jobs: [] };
const measured = new Map();
for (const job of initial.jobs.filter(j => j.status === 'done')) {
  measured.set(job.id, await size(job.sourceUrl) + await size(job.pdfUrl));
}
const reserved = initial.jobs.reduce((n, j) => n + (j.storedBytes ?? (j.inputBytes + 60 * 1048576)), 0);
console.log(JSON.stringify({ completed: measured.size, previousMiB: reserved / 1048576, measuredCompletedMiB: [...measured.values()].reduce((a,b) => a+b,0) / 1048576, apply }));
if (apply) {
  let saved = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const previous = await redis(['GET', key]);
    const queue = JSON.parse(previous);
    for (const job of queue.jobs) if (job.status === 'done' && measured.has(job.id)) job.storedBytes = measured.get(job.id);
    const script = "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end";
    if (Number(await redis(['EVAL', script, '1', key, previous, JSON.stringify(queue)])) === 1) { saved = true; break; }
  }
  if (!saved) throw Error('Queue changed; retry later');
  console.log('Verified byte accounting saved. All lesson files preserved.');
}
