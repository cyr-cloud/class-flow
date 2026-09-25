import { kv } from "./storage";
import type { LiveState } from "./types";

export const BACKUP_INTERVAL = 5 * 60_000;
export interface BackupSummary {
  revision: number; savedAt: number; reason: string; name: string; answers: number;
}
export interface LessonBackup { summary: BackupSummary; state: LiveState }
const indexKey = (id: string) => `backup-index:${id}`;
const dataKey = (id: string, revision: number) => `backup:${id}:${revision}`;

export async function listBackups(id: string): Promise<BackupSummary[]> {
  return JSON.parse(await kv().get(indexKey(id)) ?? "[]");
}
export async function readBackup(id: string, revision: number): Promise<LessonBackup | null> {
  const raw = await kv().get(dataKey(id, revision));
  return raw ? JSON.parse(raw) : null;
}

export async function saveBackup(id: string, state: LiveState, reason: string) {
  // Explicit fields keep teacher credentials out of exported archives.
  const snapshot: LiveState = {
    session: state.session, deck: state.deck, revision: state.revision,
    responses: state.responses, posts: state.posts,
    wordResponses: state.wordResponses ?? [], surveyResponses: state.surveyResponses ?? [], reactions: [],
  };
  const summary: BackupSummary = {
    revision: state.revision, savedAt: Date.now(), reason,
    name: state.session.pdfName ?? "수업",
    answers: state.responses.length + (state.wordResponses?.length ?? 0) + (state.surveyResponses?.length ?? 0),
  };
  // Immutable revision snapshots have no automatic expiry. Never overwrite a backup.
  await kv().compareAndSet(dataKey(id, state.revision), null, JSON.stringify({ summary, state: snapshot }));
  const saved = await readBackup(id, state.revision);
  if (!saved) throw new Error("수업 백업을 저장하지 못했어요. 기존 자료는 유지됩니다.");
  for (let attempt = 0; attempt < 12; attempt++) {
    const previous = await kv().get(indexKey(id));
    const entries: BackupSummary[] = JSON.parse(previous ?? "[]");
    if (entries.some(entry => entry.revision === state.revision)) return;
    entries.push(saved.summary);
    entries.sort((a, b) => b.revision - a.revision);
    if (await kv().compareAndSet(indexKey(id), previous, JSON.stringify(entries))) return;
  }
  throw new Error("백업 목록 저장이 지연됐어요. 다시 시도해 주세요.");
}
