import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
// Isolated from production Redis, Blob and the existing development server.
mkdirSync('.classflow', { recursive: true });
const file = '.classflow/chat-dev-secret';
if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
const env = { ...process.env, CLASSFLOW_LOCAL_ONLY: '1', CHAT_TOKEN_SECRET: readFileSync(file, 'utf8'), CHAT_SERVER_URL: 'http://127.0.0.1:3400', CHAT_ALLOWED_ORIGINS: 'http://127.0.0.1:3312', CHAT_LOCAL_DATA: path.resolve('.classflow/chat-db'), PORT: '3400', HOST: '127.0.0.1' };
const children = [spawn(process.execPath, ['chat-server/index.mjs'], { env, stdio: 'inherit' }), spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3312', '--hostname', '127.0.0.1'], { env, stdio: 'inherit' })];
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { children.forEach(c=>c.kill()); process.exit(); });
children.forEach(child => child.on('exit', code => { children.forEach(c=>c.kill()); process.exit(code || 0); }));
