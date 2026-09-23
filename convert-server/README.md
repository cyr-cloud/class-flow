# ClassFlow PPT conversion

The site stays on Vercel. The agent on Lightsail makes outbound HTTPS requests;
no inbound converter port, custom domain, or public LibreOffice endpoint is needed.

1. Authenticated teacher browser encrypts the original PPTX with AES-256-GCM.
2. A path/size-limited upload token sends encrypted bytes directly to public Blob.
3. Vercel stores the encryption key and job metadata in the shared Redis KV, separately from public lesson state.
4. The outbound agent claims one job using `CONVERSION_WORKER_SECRET`, downloads/decrypts it to temporary files, and calls the loopback-only Python converter.
5. A separate path-limited token uploads the PDF. Vercel checks Blob metadata before accepting completion.
6. The teacher browser reads PDF titles and replaces the lesson only after success. Students receive the shared PDF URL. Teacher-only original download decrypts in the browser.

AI is not invoked by upload. The teacher may explicitly generate quizzes from the saved PPT notes afterward.

## Installation

Use Ubuntu 24.04, LibreOffice Impress, Noto CJK, Python 3, and Node 24 LTS.
Copy `worker.py`, `agent.mjs`, `package.json` to `/opt/classflow-convert`.
Install the pinned npm dependency there with `npm install --omit=dev --ignore-scripts`.
Install both service files in `/etc/systemd/system` and reload systemd.

The Python service binds only `127.0.0.1:8090`; its systemd network restriction stays in place.
The agent needs outbound network access; it holds no Redis or Blob master token.

Root-owned `/etc/classflow-agent.env` (mode 600) must contain:

```
CLASSFLOW_URL=https://class-flow-fawn.vercel.app
CONVERSION_WORKER_SECRET=<random 32-byte secret, never commit>
```

In the Vercel project Production environment, set the same worker secret and
`PPT_CONVERSION_ENABLED=1`. Existing Blob and Upstash variables must be available.
Redeploy for environment changes to take effect. Start the agent after configuration.
Do not publish the secret in screenshots, logs, commit messages, or frontend variables.

## Limits and recovery

- One conversion at a time, five waiting/uploading jobs maximum, 20 attempts per UTC day.
- Source PPTX <=200 MiB, PDF <=60 MiB, LibreOffice timeout 180 seconds.
- Trial storage reservation: 512 MiB across source bytes + worst-case PDF sizes of all retained jobs (including failures). No automatic deletion. This does not cap other Blob usage or AWS billing.
- Python additionally reserves 60 MiB output per attempt against a monthly 5 GiB limit; unsuccessful work is counted conservatively.
- Worker claims expire in ten minutes. An expired job fails, so a stale completion cannot overwrite it. Upload/queued jobs expire after twenty minutes.
- Queue polling is every 30 seconds when idle. Unchanged reads don't write the queue.
- Browser stores the pending job ID; `변환 결과 확인` resumes after refresh or a transient failure.
- An upload/convert failure leaves the current class unchanged. Teachers can still upload a PDF.
- If retaining larger volumes, implement explicit material deletion/retention before increasing storage limits.

## Verification status

See `docs/development-checklist.md`. Passing local tests is not evidence that the deployed Vercel/Blob/agent chain works. Verify a real production job and student PDF before calling the integration complete.
