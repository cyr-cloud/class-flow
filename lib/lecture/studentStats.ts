// 학생별 참여 집계.
//
// 숫자는 전부 여기서 코드로 센다 — AI는 이 숫자를 읽고 해석만 쓴다 (app/api/student-report).
// 학생 식별자는 탭 단위(responderId)라서, 새 탭을 열면 같은 사람이 둘로 갈린다.
// 이름(채팅 입장 이름·결과물 작성자 이름)이 같으면 한 사람으로 합친다.

import type { Deck, LabPost, QuizResponse } from "../types";
import type { SurveyResponse } from "./survey";

/** 샘플 수업에 미리 올려 둔 강사 예시 결과물 (lib/live/sample.ts의 SEED_OWNER) */
const SEED_OWNER = "seed";

export type Roster = Record<string, { name: string; at: number }>;
/** 채팅 서버에서 강사 화면이 받아 둔 메시지를 이름별로 센 것 */
export type ChatCounts = Record<string, { count: number; samples: string[] }>;

export interface StudentStat {
  key: string;
  name: string;
  /** 이름을 한 번도 적지 않은 학생은 "학생 1"처럼 붙인다 */
  named: boolean;
  quizAnswered: number;
  /** 정답이 정해진 문항 중 답한 수 (설문형은 빠진다) */
  quizGraded: number;
  quizCorrect: number;
  /** 0~100. 채점할 문항이 없으면 null */
  accuracy: number | null;
  posts: number;
  likesReceived: number;
  surveys: number;
  words: number;
  chats: number;
  /** 진행된 참여 활동 중 참여한 비율 0~100. 진행된 활동이 없으면 null */
  participation: number | null;
}

export interface ClassSummary {
  students: number;
  /** 한 명이라도 답한 퀴즈 문항 수 — "진행된 문항"으로 본다 */
  quizItemsRun: number;
  /** 퀴즈 + 설문 + 워드클라우드 중 진행된 것 */
  activitiesRun: number;
  posts: number;
  chats: number;
  averageAccuracy: number | null;
  averageParticipation: number | null;
}

export interface StudentStatsInput {
  deck: Deck | null;
  responses: QuizResponse[];
  posts: LabPost[];
  surveyResponses?: SurveyResponse[];
  wordResponses?: { slideId: string; responderId: string; word: string }[];
  roster?: Roster;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));

export function computeStudentStats(input: StudentStatsInput, chat: ChatCounts = {}): { students: StudentStat[]; summary: ClassSummary } {
  const items = new Map((input.deck?.slides ?? []).flatMap(s => s.items).map(q => [q.id, q]));
  const posts = input.posts.filter(p => p.ownerId !== SEED_OWNER);
  const surveys = input.surveyResponses ?? [];
  const words = input.wordResponses ?? [];
  const roster = input.roster ?? {};

  // 탭 식별자 → 이름. 채팅 이름이 우선이고, 없으면 마지막으로 적은 결과물 작성자 이름
  const nameOf = (id: string) => {
    const fromRoster = roster[id]?.name?.trim();
    if (fromRoster) return fromRoster;
    const post = [...posts].reverse().find(p => p.ownerId === id && p.authorName.trim());
    return post?.authorName.trim() ?? "";
  };

  const ids = new Set<string>([
    ...input.responses.map(r => r.responderId),
    ...posts.map(p => p.ownerId),
    ...surveys.map(r => r.responderId),
    ...words.map(r => r.responderId),
    ...Object.keys(roster),
  ]);

  const byKey = new Map<string, StudentStat>();
  let unnamed = 0;
  const entry = (key: string, name: string, named: boolean) => {
    let stat = byKey.get(key);
    if (!stat) {
      stat = { key, name, named, quizAnswered: 0, quizGraded: 0, quizCorrect: 0, accuracy: null, posts: 0, likesReceived: 0, surveys: 0, words: 0, chats: 0, participation: null };
      byKey.set(key, stat);
    }
    return stat;
  };
  const keyOfId = new Map<string, string>();
  for (const id of ids) {
    const name = nameOf(id);
    const key = name ? `name:${name}` : `id:${id}`;
    keyOfId.set(id, key);
    if (!byKey.has(key)) entry(key, name || `학생 ${++unnamed}`, !!name);
  }

  // 같은 이름이 여러 탭에서 같은 문항에 답했으면 마지막 답만 센다
  const lastAnswer = new Map<string, QuizResponse>();
  for (const r of input.responses) {
    const key = keyOfId.get(r.responderId);
    if (!key || !items.has(r.itemId)) continue;
    const k = `${key}|${r.itemId}`;
    const prev = lastAnswer.get(k);
    if (!prev || prev.createdAt <= r.createdAt) lastAnswer.set(k, r);
  }
  for (const [k, r] of lastAnswer) {
    const stat = byKey.get(k.split("|")[0])!;
    const item = items.get(r.itemId)!;
    stat.quizAnswered += 1;
    if (item.answers.length > 0) {
      stat.quizGraded += 1;
      if (sameSet(r.choiceIndices ?? [r.choiceIndex], item.answers)) stat.quizCorrect += 1;
    }
  }

  for (const p of posts) {
    const stat = byKey.get(keyOfId.get(p.ownerId)!)!;
    stat.posts += 1;
    stat.likesReceived += (p.likes ?? []).filter(l => l !== p.ownerId).length;
  }
  const surveyDone = new Set<string>();
  for (const r of surveys) {
    const k = `${keyOfId.get(r.responderId)}|${r.slideId}`;
    if (surveyDone.has(k)) continue;
    surveyDone.add(k);
    byKey.get(keyOfId.get(r.responderId)!)!.surveys += 1;
  }
  const wordDone = new Set<string>();
  for (const r of words) {
    const k = `${keyOfId.get(r.responderId)}|${r.slideId}`;
    if (wordDone.has(k)) continue;
    wordDone.add(k);
    byKey.get(keyOfId.get(r.responderId)!)!.words += 1;
  }

  // 채팅은 이름으로만 이어진다. 채팅만 하고 다른 활동이 없는 학생도 명단에 올린다
  for (const [name, c] of Object.entries(chat)) {
    const trimmed = name.trim();
    if (!trimmed || c.count <= 0) continue;
    entry(`name:${trimmed}`, trimmed, true).chats += c.count;
  }

  const quizItemsRun = new Set([...lastAnswer.values()].map(r => r.itemId)).size;
  const activitiesRun = quizItemsRun + new Set(surveys.map(r => r.slideId)).size + new Set(words.map(r => r.slideId)).size;

  const students = [...byKey.values()].map(s => ({
    ...s,
    accuracy: pct(s.quizCorrect, s.quizGraded),
    participation: pct(s.quizAnswered + s.surveys + s.words, activitiesRun),
  }));
  students.sort((a, b) => (b.participation ?? -1) - (a.participation ?? -1) || b.posts - a.posts || a.name.localeCompare(b.name, "ko"));

  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return {
    students,
    summary: {
      students: students.length,
      quizItemsRun,
      activitiesRun,
      posts: posts.length,
      chats: students.reduce((n, s) => n + s.chats, 0),
      averageAccuracy: avg(students.map(s => s.accuracy)),
      averageParticipation: avg(students.map(s => s.participation)),
    },
  };
}

/** 가장 높은 값을 가진 학생들 (동점이면 여럿). 값이 0이면 아무도 없다 */
export function leaders(students: StudentStat[], pick: (s: StudentStat) => number | null): StudentStat[] {
  const values = students.map(pick).filter((v): v is number => v !== null && v > 0);
  if (!values.length) return [];
  const top = Math.max(...values);
  return students.filter(s => pick(s) === top);
}

/** AI가 쓴 학생별 참여 일지. 강사 화면에만 보인다 */
export interface StudentJournal {
  key: string;
  name: string;
  /** 기록에서 보이는 참여 방식 2~3문장 */
  summary: string;
  strengths: string[];
  watch: string[];
  /** 다음 수업에서 강사가 해볼 만한 것 한 가지 */
  suggestion: string;
  /** 강사가 직접 보고 적은 관찰 메모. AI가 다시 분석해도 지우지 않는다 */
  teacherNote?: string;
  /** 강사가 마지막으로 손으로 고친 시각 */
  editedAt?: number;
  /** «AI로 다듬기»를 마지막으로 누른 시각 */
  refinedAt?: number;
}

/** 강사가 고칠 수 있는 칸 — 편집 저장과 «AI로 다듬기»가 같은 모양을 쓴다 */
export type JournalDraft = Pick<StudentJournal, "summary" | "strengths" | "watch" | "suggestion"> & { teacherNote: string };

/** 강사 입력을 저장 가능한 모양으로 다듬는다. 길이를 넘기거나 모양이 틀리면 던진다 */
export function cleanJournalDraft(d: JournalDraft): JournalDraft {
  const text = (v: unknown, max: number) => {
    if (typeof v !== "string") throw new Error("일지 내용을 확인해 주세요.");
    const t = v.replace(/\r\n?/g, "\n").trim();
    if (t.length > max) throw new Error(`한 칸에 ${max}자까지 적을 수 있어요.`);
    return t;
  };
  const list = (v: unknown, n: number) => {
    if (!Array.isArray(v) || v.length > n) throw new Error(`목록은 ${n}개까지 적을 수 있어요.`);
    return v.map(x => text(x, 200)).filter(Boolean);
  };
  return { summary: text(d?.summary, 800), strengths: list(d?.strengths, 5), watch: list(d?.watch, 5), suggestion: text(d?.suggestion, 300), teacherNote: text(d?.teacherNote ?? "", 1000) };
}

export interface StudentReport {
  createdAt: number;
  /** 리포트를 만들 때 본 기록의 시점 — 이후 참여는 반영되지 않았다는 표시용 */
  basedOnRevision: number;
  overview: string;
  journals: StudentJournal[];
}
