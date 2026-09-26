import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyTicket(ticket, secret) {
  if (typeof ticket !== 'string' || ticket.length > 4096) throw Error('입장 인증이 필요해요.');
  const [data, signature, extra] = ticket.split('.');
  const expected = createHmac('sha256', secret).update(data || '').digest('base64url');
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw Error('입장 인증이 올바르지 않아요.');
  const actor = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (!/^[\w-]{1,64}$/.test(actor.room) || !/^[a-f0-9]{64}$/.test(actor.id) || !['student', 'teacher'].includes(actor.role) || typeof actor.name !== 'string' || !actor.name.trim() || actor.name.length > 30 || !Number.isFinite(actor.exp) || actor.exp <= Date.now()) throw Error('입장 인증이 만료됐어요. 다시 연결해 주세요.');
  return actor;
}
export const EMOJIS = ['👍', '✅', '❤️', '👏', '😂', '🙋'];

export function validateCommand(input, actor) {
  if (!input || typeof input !== 'object') throw Error('잘못된 요청이에요.');
  if (input.type === 'message') {
    if (!/^[\w-]{8,80}$/.test(input.clientId) || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) throw Error('메시지는 1~2,000자로 입력해 주세요.');
    return { type: 'message', clientId: input.clientId, text: input.text.trim() };
  }
  if (!/^\d{1,18}$/.test(String(input.messageId))) throw Error('메시지를 확인해 주세요.');
  if (input.type === 'reaction' && EMOJIS.includes(input.emoji) && typeof input.active === 'boolean') return input;
  if (input.type === 'pin' && actor.role === 'teacher' && typeof input.active === 'boolean') return input;
  throw Error('이 작업을 할 권한이 없거나 요청이 올바르지 않아요.');
}
