// Run directly on the server. Does not log secrets unless explicitly requested.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const file = fileURLToPath(new URL('.env', import.meta.url));
const hostname = process.argv[2];
if (!hostname || !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) throw Error('Provide the verified HTTPS hostname');
if (existsSync(file)) throw Error('.env already exists; keep the current secrets and inspect configuration manually.');
writeFileSync(file, `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nCHAT_TOKEN_SECRET=${randomBytes(32).toString('hex')}\nCHAT_HOSTNAME=${hostname}\n`, { mode: 0o600, flag: 'wx' });
console.log('Private configuration created. Secrets were not printed.');
