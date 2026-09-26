"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { liveClient, emptyLive } from '@/lib/live/client';
import styles from './ChatMessage.module.css';

const EMOJIS = ['👍', '✅', '❤️', '👏', '😂', '🙋'];
type Reaction = { actor: string; name: string; emoji: string };
type Message = { id: string; actor: string; name: string; role: string; text: string; createdAt: string; reactions: Reaction[] };
type Snapshot = { revision: number; messages: Message[]; pinned: Message | null; hasMore: boolean; people?: { id: string; name: string }[] };
type Ack = { ok: boolean; error?: string; data?: Snapshot };
type Command = { type: string; [key: string]: string | boolean };
type ChatContext = {
  enabled: boolean; open: boolean; setOpen: (v: boolean) => void; fullscreen: boolean; setFullscreen: (v: boolean) => void;
  unread: number; status: string; error: string; name: string; id: string; teacher: boolean;
  data: Snapshot; send: (c: Command) => Promise<void>; history: () => Promise<void>; rename: () => void;
  draft: string; setDraft: (v: string) => void; sendDraft: () => Promise<void>; busy: boolean;
};
const Context = createContext<ChatContext | null>(null);
export const useChat = () => useContext(Context);
const EMPTY: Snapshot = { revision: -1, messages: [], pinned: null, hasMore: false };
const serverLive = () => emptyLive;
const noSubscribe = () => () => {};

export default function ChatRoom({ children, sessionId, role, enabled }: { children: ReactNode; sessionId: string; role: 'teacher' | 'student'; enabled: boolean }) {
  const client = liveClient(sessionId);
  const live = useSyncExternalStore(enabled ? client.subscribe : noSubscribe, client.snapshot, serverLive);
  const roomReady = live.revision >= 0;
  const [open, setOpen] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const [name, setName] = useState(''), [id, setId] = useState(''), [status, setStatus] = useState('연결 준비 중');
  const [error, setError] = useState(''), [data, setData] = useState<Snapshot>(EMPTY), [unread, setUnread] = useState(0);
  const [nameDraft, setNameDraft] = useState(''), [joining, setJoining] = useState(false);
  const [draft, setDraft] = useState(''), [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const pending = useRef<{ clientId: string; text: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), socket = useRef<Socket | null>(null);
  const revision = useRef(-1), latest = useRef(''), opened = useRef(false), generation = useRef(0);
  const key = `classflow:chat-name:${role}:${sessionId}`;
  const join = useCallback(async (displayName: string) => {
    const attempt = ++generation.current;
    setJoining(true); setError('');
    try {
      const response = await fetch('/api/chat/join', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-teacher-token': role === 'teacher' ? localStorage.getItem(`classflow:teacher:${sessionId}`) || '' : '' }, body: JSON.stringify({ sessionId, name: displayName, role }) });
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      if (attempt !== generation.current) return;
      socket.current?.disconnect();
      setName(body.actor.name); setId(body.actor.id); localStorage.setItem(key, body.actor.name);
      dialog.current?.close();
      const connection = io(body.url, { auth: { ticket: body.ticket }, transports: ['websocket'], reconnectionDelayMax: 5000 });
      socket.current = connection;
      connection.on('connect', () => { setStatus('실시간 연결됨'); setError(''); });
      connection.on('disconnect', () => setStatus('연결 끊김 · 다시 입장해 주세요'));
      connection.on('connect_error', () => setStatus('연결 실패 · 다시 입장해 주세요'));
      connection.on('chat-error', (message: string) => setError(message));
      connection.on('snapshot', (next: Snapshot) => {
        if (next.revision < revision.current) return;
        revision.current = next.revision;
        const newest = next.messages.at(-1)?.id || '';
        if (latest.current && !opened.current) setUnread(n => n + next.messages.filter(m => BigInt(m.id) > BigInt(latest.current)).length);
        latest.current = newest;
        setData(current => ({ ...next, messages: [...current.messages.filter(m => next.messages.length > 0 && BigInt(m.id) < BigInt(next.messages[0].id)), ...next.messages], hasMore: current.messages.length > 100 ? current.hasMore : next.hasMore }));
      });
    } catch (e) { setError(e instanceof Error ? e.message : '채팅 입장에 실패했어요.'); setStatus('연결 실패 · 다시 입장해 주세요'); }
    finally { if (attempt === generation.current) setJoining(false); }
  }, [key, role, sessionId]);
  useEffect(() => {
    if (!enabled || !roomReady) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const saved = role === 'teacher' ? '강사' : localStorage.getItem(key);
      if (saved) void join(saved); else dialog.current?.showModal();
    });
    const invalidate = () => { generation.current++; socket.current?.disconnect(); };
    return () => { active = false; invalidate(); };
  }, [enabled, roomReady, key, role, join]);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === 'visible' && socket.current?.connected) socket.current.emit('sync'); };
    document.addEventListener('visibilitychange', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled]);
  const toggle = (value: boolean) => { opened.current = value; setOpen(value); if (value) setUnread(0); };
  const send = async (command: Command) => {
    if (!socket.current?.connected) throw Error('채팅 연결을 확인해 주세요.');
    const ack: Ack = await socket.current.timeout(10000).emitWithAck('command', command);
    if (!ack.ok) throw Error(ack.error || '저장하지 못했어요.');
  };
  const sendDraft = async () => {
    if (sending.current || !draft.trim()) return;
    sending.current = true; setBusy(true);
    const text = draft.trim();
    if (!pending.current || pending.current.text !== text) pending.current = { clientId: crypto.randomUUID(), text };
    try {
      await send({ type: 'message', ...pending.current });
      setDraft(current => current.trim() === text ? '' : current);
      pending.current = null;
    } finally { sending.current = false; setBusy(false); }
  };
  const history = async () => {
    if (!socket.current?.connected || !data.messages.length) return;
    const ack: Ack = await socket.current.timeout(10000).emitWithAck('history', data.messages[0].id);
    if (!ack.ok || !ack.data) throw Error(ack.error || '이전 대화를 읽지 못했어요.');
    const older = ack.data;
    setData(current => ({ ...current, hasMore: older.hasMore, messages: [...older.messages.filter(m => !current.messages.some(c => c.id === m.id)), ...current.messages] }));
  };
  const rename = () => { setNameDraft(name); dialog.current?.showModal(); };
  const context = { enabled, open, setOpen: toggle, fullscreen, setFullscreen, unread, status, error, name, id, teacher: role === 'teacher', data, send, history, rename, draft, setDraft, sendDraft, busy };
  return <Context.Provider value={context}>
    <div className={enabled && open && !fullscreen ? 'lg:pr-96' : ''}>{children}</div>
    {enabled && open && !fullscreen && <div className="fixed bottom-0 right-0 z-40 h-[65dvh] w-full lg:top-14 lg:h-auto lg:w-96"><ChatPanel /></div>}
    {enabled && <dialog ref={dialog} aria-label="채팅 참여 이름" className="m-auto w-[min(92vw,420px)] rounded-2xl bg-paper p-6 shadow-xl backdrop:bg-black/50">
      <form onSubmit={e => { e.preventDefault(); void join(role === 'teacher' ? '강사' : nameDraft); }}>
        <h2 className="text-xl font-bold">수업에서 사용할 이름</h2>
        <p className="my-3 text-sm text-ink-soft">채팅과 이모지 반응에 표시돼요. 같은 브라우저에서는 기억합니다.</p>
        {role === 'student' && <input aria-label="이름 또는 닉네임" autoFocus required maxLength={30} value={nameDraft} onChange={e => setNameDraft(e.target.value)} className="w-full rounded-lg border border-line p-3" placeholder="이름 또는 닉네임" />}
        {error && <p role="alert" className="mt-2 text-sm text-rosetan-deep">{error}</p>}
        <div className="mt-4 flex gap-2"><button disabled={joining} className="min-h-12 flex-1 rounded-full bg-ink px-6 py-3 text-white">{joining ? '연결 중…' : '채팅 입장'}</button><button type="button" onClick={() => dialog.current?.close()} className="px-3">나중에</button></div>
      </form>
    </dialog>}
  </Context.Provider>;
}

export function ChatToggle() {
  const chat = useChat();
  if (!chat?.enabled) return null;
  return <button type="button" aria-expanded={chat.open} onClick={() => chat.setOpen(!chat.open)} className="ui-action ui-action-blue rounded-full border px-4 py-2 text-sm font-medium">💬 채팅{chat.unread > 0 ? ` ${chat.unread}` : ''}</button>;
}

export function ChatPanel() {
  const chat = useChat();
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null), nearBottom = useRef(true);
  const lastId = chat?.data.messages.at(-1)?.id;
  useEffect(() => { if (nearBottom.current) bottom.current?.scrollIntoView({ block: 'nearest' }); }, [lastId]);
  if (!chat) return null;
  const { draft, setDraft, busy } = chat;
  const run = async (cmd: Command) => { try { setError(''); await chat.send(cmd); } catch (e) { setError(e instanceof Error ? e.message : '전송 실패 · 다시 시도해 주세요.'); } };
  const render = (m: Message, pinned = false, grouped = false) => <ChatMessage key={m.id} message={m} grouped={grouped} pinned={pinned} teacher={chat.teacher} actorId={chat.id} run={run} />;
  const pinned = chat.data.pinned;
  const waiting = chat.data.people?.filter(p => !pinned?.reactions.some(r => r.actor === p.id)) || [];
  return <aside aria-label="실시간 수업 채팅" className="flex h-full min-h-0 flex-col border-l border-line-strong bg-cream text-ink shadow-xl">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-gardenia p-4 text-ink">
      <div><h2 className="font-bold">수업 채팅</h2><p className="text-xs text-ink-soft" role="status">{chat.status}</p></div>
      <div className="flex items-center gap-1">
        <details className="relative"><summary aria-label="채팅 설정" className="flex min-h-11 min-w-11 list-none items-center justify-center rounded-full text-xl [&::-webkit-details-marker]:hidden">⋯</summary>
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-paper p-2 shadow-lg">
            <p className="break-words px-3 py-2 text-xs text-ink-soft">{chat.name || '아직 입장하지 않았어요'}</p>
            <button type="button" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); chat.rename(); }} className="w-full rounded-lg px-3 py-3 text-left text-sm">{chat.name ? '이름 변경 / 다시 입장' : '이름 입력하고 입장'}</button>
          </div>
        </details>
        <button type="button" aria-label="채팅 닫기" title="채팅 닫기" onClick={() => chat.setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-mocha-tint hover:text-ink">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </header>
    {pinned && <div className="max-h-[35%] shrink-0 overflow-auto border-b border-tendril/40 bg-tendril-tint p-3"><p className="mb-2 text-xs font-bold">📌 진행 확인</p>{render(pinned, true)}{chat.teacher && <details className="mt-2 text-xs"><summary className="cursor-pointer">아직 반응하지 않은 참여자 {waiting.length}명</summary><p className="mt-2">{waiting.map(p => p.name).join(', ') || '모두 반응했어요.'}</p><p className="mt-1 text-mute">이 채팅에 입장한 학생 기준입니다. 미반응이 미완료를 의미하지는 않아요.</p></details>}</div>}
    <div className="min-h-0 flex-1 overflow-auto px-4 pb-3 pt-5" onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
      {chat.data.hasMore && <button className="w-full text-sm underline" onClick={() => void chat.history().catch(() => setError('이전 대화를 읽지 못했어요.'))}>이전 대화 더 보기</button>}
      {chat.data.messages.map((m, index) => {
        const previous = chat.data.messages[index - 1];
        const gap = previous ? Date.parse(m.createdAt) - Date.parse(previous.createdAt) : Infinity;
        const grouped = !!previous && previous.actor === m.actor && previous.name === m.name && previous.role === m.role && gap >= 0 && gap < 5 * 60_000 && new Date(previous.createdAt).toDateString() === new Date(m.createdAt).toDateString();
        return render(m, m.id === pinned?.id, grouped);
      })}<div ref={bottom} />
    </div>
    {(error || chat.error) && <p role="alert" className="px-3 text-sm text-rosetan-deep">{error || chat.error}</p>}
    <form className="shrink-0 border-t border-mocha/30 bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onSubmit={async e => {
      e.preventDefault(); if (busy || !draft.trim()) return;
      setError('');
      try { await chat.sendDraft(); nearBottom.current = true; }
      catch { setError('전송을 확인하지 못했어요. 다시 보내도 같은 메시지는 중복 저장되지 않습니다.'); }
    }}>
      <div className="flex gap-2"><textarea aria-label="채팅 메시지" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} rows={2} placeholder="메시지를 입력하세요" className="min-w-0 flex-1 resize-none rounded-lg border border-mocha/40 bg-paper p-2 text-base sm:text-sm" /><button disabled={busy || !draft.trim()} className="rounded-lg bg-mocha-deep px-3 text-sm text-white disabled:opacity-40">보내기</button></div>
    </form>
  </aside>;
}

function ChatMessage({ message: m, grouped, pinned, teacher, actorId, run }: { message: Message; grouped: boolean; pinned: boolean; teacher: boolean; actorId: string; run: (cmd: Command) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const react = (emoji: string) => {
    const mine = m.reactions.some(r => r.emoji === emoji && r.actor === actorId);
    void run({ type: 'reaction', messageId: m.id, emoji, active: !mine });
    setExpanded(false);
  };
  return <article tabIndex={0} aria-label={`${m.role === 'teacher' ? '강사' : m.name}의 메시지`} title={new Date(m.createdAt).toLocaleString("ko-KR")} className={`${styles.message} px-1 pb-1 ${grouped ? "pt-0.5" : "mt-4 pt-2 first:mt-0"} outline-offset-2`} onKeyDown={e => { if (e.key === 'Escape' && expanded) { e.stopPropagation(); setExpanded(false); } }}>
    <div aria-label="메시지 작업" className={`${styles.actions} ${expanded ? styles.expanded : ''} rounded-full border border-line bg-paper p-1 shadow-md`}>
      {EMOJIS.map(emoji => <button type="button" key={emoji} title={`${emoji} 반응`} aria-label={`${emoji} 반응 추가 또는 취소`} aria-pressed={m.reactions.some(r => r.emoji === emoji && r.actor === actorId)} onClick={() => react(emoji)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg hover:bg-gardenia focus-visible:bg-gardenia">{emoji}</button>)}
      {teacher && <button type="button" title={pinned ? '고정 해제' : '진행 확인으로 고정'} aria-label={pinned ? '고정 해제' : '진행 확인으로 고정'} aria-pressed={pinned} onClick={() => { void run({ type: 'pin', messageId: m.id, active: !pinned }); setExpanded(false); }} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-l border-line hover:bg-gardenia ${pinned ? 'text-mocha' : 'text-ink-soft'}`}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3h8l-1 7 4 4v2H5v-2l4-4zM12 16v5" /></svg>
      </button>}
    </div>
    <div className={grouped ? 'sr-only' : 'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft'}>
      <strong className="break-all text-sm text-ink">{m.name}</strong>
      {m.role === 'teacher' && m.name !== '강사' && <span className="rounded bg-mocha-tint px-1.5 py-0.5 text-[11px] font-medium text-mocha-deep">강사</span>}
      <time dateTime={m.createdAt} className="shrink-0">{new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time>
    </div>
    <p className="mb-1 mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{m.text}</p>
    <div className="flex flex-wrap items-center gap-1">
      {EMOJIS.filter(emoji => m.reactions.some(r => r.emoji === emoji)).map(emoji => {
        const reactions = m.reactions.filter(r => r.emoji === emoji), mine = reactions.some(r => r.actor === actorId);
        return <button type="button" key={emoji} title={reactions.map(r => r.name).join(', ')} aria-label={`${emoji} 반응 ${reactions.length}명, ${reactions.map(r => r.name).join(', ')}. ${mine ? '내 반응 취소' : '반응 추가'}`} aria-pressed={mine} onClick={() => react(emoji)} className={`rounded-full border px-2 py-1 text-sm ${mine ? 'border-cornflower bg-cornflower-tint text-cornflower-deep' : 'border-line bg-paper'}`}>{emoji} {reactions.length}</button>;
      })}
      <button type="button" aria-label="반응 추가 및 메시지 작업" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={`${styles.touchTrigger} min-h-11 min-w-11 rounded-full border border-line text-sm text-mute`}>☺＋</button>
    </div>

  </article>;
}
