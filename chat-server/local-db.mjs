// Development/test only. PGlite runs the PostgreSQL engine; serialize its single connection.
import { PGlite } from '@electric-sql/pglite';
export async function localDatabase(path) {
  const engine = new PGlite(path); await engine.waitReady;
  let tail = Promise.resolve();
  const connect = async () => {
    const previous = tail; let release;
    tail = new Promise(resolve => { release = resolve; }); await previous;
    return { query: (sql, params) => engine.query(sql, params), release };
  };
  return { connect, query: async sql => { const c = await connect(); try { return await engine.exec(sql); } finally { c.release(); } }, end: () => engine.close() };
}
