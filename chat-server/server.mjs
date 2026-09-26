import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyTicket, validateCommand } from './auth.mjs';

export function createChatServer(store, { secret, origins }) {
  if (!secret || secret.length < 32 || !origins.length) throw Error('Chat secret/origins are required');
  const http = createServer((req, res) => { res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: req.url === '/health' })); });
  const io = new Server(http, { cors: { origin: origins }, maxHttpBufferSize: 16384,
    allowRequest: (req, done) => done(null, origins.includes(req.headers.origin)) });
  const limits = new Map();
  function rate(actor) {
    const key = `${actor.room}:${actor.id}`, now = Date.now();
    let entry = limits.get(key);
    if (!entry || now - entry.at > 10000) { entry = { at: now, count: 0 }; limits.set(key, entry); }
    if (++entry.count > 30) throw Error('잠시 기다렸다 다시 보내 주세요.');
  }
  const cleanup = setInterval(() => { for (const [key, entry] of limits) if (Date.now() - entry.at > 60000) limits.delete(key); }, 60000);
  cleanup.unref();
  async function broadcast(room) {
    const [student, teacher] = await Promise.all([store.snapshot(room), store.snapshot(room, true)]);
    io.to(`${room}:student`).emit('snapshot', student);
    io.to(`${room}:teacher`).emit('snapshot', teacher);
  }
  io.use((socket, next) => {
    try { socket.data.actor = verifyTicket(socket.handshake.auth?.ticket, secret); rate(socket.data.actor); next(); }
    catch { next(Error('채팅 인증을 확인할 수 없어요. 다시 연결해 주세요.')); }
  });
  io.on('connection', socket => {
    const actor = socket.data.actor;
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(actor.exp - Date.now(), 2147483647));
    const ready = store.join(actor).then(async () => {
      if (!socket.connected) return;
      await socket.join(`${actor.room}:${actor.role}`);
      await broadcast(actor.room);
    });
    ready.catch(() => { socket.emit('chat-error', '채팅 저장소에 연결하지 못했어요.'); socket.disconnect(true); });
    socket.on('command', async (input, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (actor.exp <= Date.now()) throw Error('인증이 만료됐어요.');
        rate(actor); await ready;
        const cmd = validateCommand(input, actor);
        const id = await store.command(actor, cmd);
        ack({ ok: true, id }); // Acknowledge only after durable commit.
        void broadcast(actor.room).catch(() => socket.emit('chat-error', '메시지는 저장됐지만 화면 갱신이 늦어지고 있어요.'));
      } catch (error) { ack({ ok: false, error: error instanceof Error && !error.code ? error.message : '저장에 실패했어요. 다시 시도해 주세요.' }); }
    });
    socket.on('history', async (before, ack) => {
      if (typeof ack !== 'function') return;
      try { rate(actor); await ready; if (!/^\d{1,18}$/.test(String(before))) throw Error('잘못된 조회예요.'); ack({ ok: true, data: await store.snapshot(actor.room, actor.role === 'teacher', before) }); }
      catch { ack({ ok: false, error: '이전 대화를 불러오지 못했어요.' }); }
    });
    socket.on('sync', async () => {
      try { rate(actor); await ready; socket.emit('snapshot', await store.snapshot(actor.room, actor.role === 'teacher')); }
      catch { socket.emit('chat-error', '채팅을 새로 불러오지 못했어요.'); }
    });
    socket.on('disconnect', () => clearTimeout(expiry));
  });
  return { http, io, close: () => { clearInterval(cleanup); return new Promise(resolve => io.close(resolve)); } };
}
