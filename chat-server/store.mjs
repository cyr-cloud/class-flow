export const schema = `
CREATE TABLE IF NOT EXISTS chat_rooms (id text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0, pinned bigint);
CREATE TABLE IF NOT EXISTS chat_people (room text REFERENCES chat_rooms(id), id text, name text NOT NULL, role text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(room,id));
CREATE TABLE IF NOT EXISTS chat_messages (id bigserial PRIMARY KEY, room text REFERENCES chat_rooms(id), actor text NOT NULL, client_id text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(room,actor,client_id));
CREATE INDEX IF NOT EXISTS chat_messages_room_id ON chat_messages(room,id);
CREATE TABLE IF NOT EXISTS chat_reactions (message bigint REFERENCES chat_messages(id), actor text NOT NULL, emoji text NOT NULL, PRIMARY KEY(message,actor,emoji));
`;

export class ChatStore {
  constructor(db) { this.db = db; }
  async init() { await this.db.query(schema); }
  async transaction(room, fn) {
    const db = await this.db.connect();
    try {
      await db.query('BEGIN');
      await db.query('INSERT INTO chat_rooms(id) VALUES($1) ON CONFLICT DO NOTHING', [room]);
      await db.query('SELECT id FROM chat_rooms WHERE id=$1 FOR UPDATE', [room]);
      const result = await fn(db);
      await db.query('UPDATE chat_rooms SET revision=revision+1 WHERE id=$1', [room]);
      await db.query('COMMIT');
      return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
  async join(actor) {
    await this.transaction(actor.room, db => db.query(`INSERT INTO chat_people(room,id,name,role) VALUES($1,$2,$3,$4)
      ON CONFLICT(room,id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role`, [actor.room, actor.id, actor.name, actor.role]));
  }
  async command(actor, cmd) {
    return this.transaction(actor.room, async db => {
      if (cmd.type === 'message') {
        const existing = await db.query('SELECT id FROM chat_messages WHERE room=$1 AND actor=$2 AND client_id=$3', [actor.room, actor.id, cmd.clientId]);
        if (existing.rows.length) return String(existing.rows[0].id);
        const count = await db.query('SELECT count(*) AS n FROM chat_messages WHERE room=$1', [actor.room]);
        if (Number(count.rows[0].n) >= 20000) throw Error('수업당 채팅 20,000건 한도에 도달했어요. 기존 기록은 보관됩니다.');
        const result = await db.query('INSERT INTO chat_messages(room,actor,client_id,body) VALUES($1,$2,$3,$4) RETURNING id', [actor.room, actor.id, cmd.clientId, cmd.text]);
        return String(result.rows[0].id);
      }
      const target = await db.query('SELECT id FROM chat_messages WHERE room=$1 AND id=$2', [actor.room, cmd.messageId]);
      if (!target.rows.length) throw Error('이 수업의 메시지가 아니에요.');
      if (cmd.type === 'reaction') {
        if (cmd.active) await db.query('INSERT INTO chat_reactions(message,actor,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [cmd.messageId, actor.id, cmd.emoji]);
        else await db.query('DELETE FROM chat_reactions WHERE message=$1 AND actor=$2 AND emoji=$3', [cmd.messageId, actor.id, cmd.emoji]);
      } else if (cmd.type === 'pin') {
        if (actor.role !== 'teacher') throw Error('강사만 고정할 수 있어요.');
        await db.query(cmd.active ? 'UPDATE chat_rooms SET pinned=$2 WHERE id=$1' : 'UPDATE chat_rooms SET pinned=NULL WHERE id=$1 AND pinned=$2', [actor.room, cmd.messageId]);
      }
    });
  }
  async snapshot(room, teacher = false, before = null) {
    // Single repeatable-read snapshot prevents an old message set carrying a newer revision.
    const db = await this.db.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const state = (await db.query('SELECT * FROM chat_rooms WHERE id=$1', [room])).rows[0];
      const rows = (await db.query(`SELECT m.*,p.name,p.role FROM chat_messages m JOIN chat_people p ON p.room=m.room AND p.id=m.actor
        WHERE m.room=$1 AND ($2::bigint IS NULL OR m.id<$2) ORDER BY m.id DESC LIMIT 101`, [room, before])).rows;
      const hasMore = rows.length > 100;
      const messages = rows.slice(0, 100).reverse();
      let pinned = null;
      if (state?.pinned) pinned = (await db.query('SELECT m.*,p.name,p.role FROM chat_messages m JOIN chat_people p ON p.room=m.room AND p.id=m.actor WHERE m.room=$1 AND m.id=$2', [room, state.pinned])).rows[0] ?? null;
      const ids = [...messages, ...(pinned ? [pinned] : [])].map(m => String(m.id));
      const reactions = ids.length ? (await db.query('SELECT r.*,p.name FROM chat_reactions r JOIN chat_messages m ON m.id=r.message JOIN chat_people p ON p.id=r.actor AND p.room=m.room WHERE m.room=$1 AND r.message=ANY($2::bigint[])', [room, ids])).rows : [];
      const people = teacher ? (await db.query("SELECT id,name FROM chat_people WHERE room=$1 AND role='student' ORDER BY joined_at", [room])).rows : undefined;
      const format = m => ({ id: String(m.id), actor: m.actor, name: m.name, role: m.role, text: m.body, createdAt: new Date(m.created_at).toISOString(), reactions: reactions.filter(r => String(r.message) === String(m.id)).map(r => ({ actor: r.actor, name: r.name, emoji: r.emoji })) });
      await db.query('COMMIT');
      return { revision: Number(state?.revision ?? 0), messages: messages.map(format), pinned: pinned ? format(pinned) : null, hasMore, ...(teacher ? { people } : {}) };
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    finally { db.release(); }
  }
}
