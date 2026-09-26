import pg from 'pg';
import { ChatStore } from './store.mjs';
import { createChatServer } from './server.mjs';

let db;
if (process.env.CHAT_LOCAL_DATA && process.env.NODE_ENV !== 'production') {
  const { localDatabase } = await import('./local-db.mjs');
  db = await localDatabase(process.env.CHAT_LOCAL_DATA);
} else {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL required');
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}
const store = new ChatStore(db); await store.init();
const server = createChatServer(store, { secret: process.env.CHAT_TOKEN_SECRET, origins: (process.env.CHAT_ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
server.http.listen(Number(process.env.PORT || 3400), process.env.HOST || '127.0.0.1', () => console.log('ClassFlow chat ready'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); await db.end(); process.exit(0); });
