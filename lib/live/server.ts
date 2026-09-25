// 수업 하나의 진행 상태(슬라이드·덱·응답)를 다루는 서버 쪽 로직.
//
// 저장은 lib/live/storage.ts의 공유 키-값 저장소에 맡긴다 (로컬=파일, 배포=Upstash Redis).
// 쓰기는 "읽어둔 값이 그대로일 때만" 이뤄지고, 실패하면 다시 읽어서 얹는다.
// 학생 스무 명이 같은 순간에 응답을 눌러도 서로의 표를 지우지 않게 하기 위한 것이다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { initialSessionState } from "../sync/types";
import { parseDeckMarkdown } from "../lecture/parseDeck";
import { kv } from "./storage";
import { SEED_OWNER, guideFor, seedPostsFor } from "./sample";
import type { DeckSlide } from "../types";
import type { LiveState, LiveCommand } from "./types";
import { cleanSurvey, cleanSurveyResponse } from "../lecture/survey";
import { REACTIONS } from "./reactions";
import { BACKUP_INTERVAL, saveBackup } from "./backups";

/** 학생도 보낼 수 있는 명령. 나머지는 수업을 연 강사만 */
const STUDENT_ACTIONS: ReadonlySet<LiveCommand["action"]> = new Set(["respond", "addPost", "removePost", "likePost", "react", "wordRespond", "surveyRespond"]);

interface Stored extends LiveState { teacherToken: string; backupAt?: number; backupRevision?: number }

const RETRIES = 6;

/**
 * "샘플" 버튼이 여는 강의 — ICT 전주 바이브코딩 2회차.
 * 실습 6개에 갤러리가 있고 퀴즈가 9문항이라, 슬라이드·참여요소·게시판을 한 번에 보여줄 수 있다.
 *
 * `intro`는 교안에는 없고 PDF 앞에만 있는 장들이다. 다른 강의로 바꿀 때는
 * 교안 첫 슬라이드가 PDF 몇 쪽인지 확인해서 이 목록을 맞춰주면 된다.
 */
const SAMPLE = {
  deck: "data/samples/jeonju-day-02.md",
  pdf: "/samples/jeonju-vibecoding-day-02.pdf",
  name: "ICT 전주 바이브코딩 2회차 (샘플)",
  intro: ["출석 확인 · 접속 직후 할 일", "DAY 2 — Claude 데스크탑 앱으로 문서 작업하기"],
} as const;

export function validId(id: string) { return /^[a-zA-Z0-9_-]{1,64}$/.test(id); }
function key(id: string) { return `session:${id}`; }

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as Stored; } catch { return null; }
}

/**
 * 방금 읽어온 수업. 같은 순간에 들어온 폴링들이 저장소를 한 번만 열게 한다.
 *
 * 학생 서른 명이 0.7초마다 «바뀐 거 있어요?»를 묻는데, 그때마다 저장소를 열면
 * 세 시간 수업 한 번에 오십만 번을 읽는다 (Upstash 무료 한도가 대략 그만큼이다).
 * 거의 같은 시각의 질문들은 같은 답을 받아야 맞으므로, 짧게 들고 있다가 나눠준다.
 *
 * 수업이 바뀌는 쪽(execute)은 이 기억을 쓰지 않는다 — 쓰기는 항상 최신 값 위에 얹어야 한다.
 */
const CACHE_MS = 500;
const cachedReads = new Map<string, { at: number; raw: string | null }>();

async function readRaw(id: string): Promise<string | null> {
  const hit = cachedReads.get(id);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.raw;

  const raw = await kv().get(key(id));
  cachedReads.set(id, { at: now, raw });
  // 오래된 것은 흘려보낸다 — 세션이 쌓여도 메모리가 늘지 않게
  if (cachedReads.size > 200) {
    for (const [k, v] of cachedReads) if (now - v.at > CACHE_MS) cachedReads.delete(k);
  }
  return raw;
}

/** 수업이 바뀌었으니 기억해 둔 답을 버린다 */
function forget(id: string) {
  cachedReads.delete(id);
}

export async function readSession(id: string, fresh = false): Promise<Stored | null> {
  if (!validId(id)) return null;
  return parse(await (fresh ? kv().get(key(id)) : readRaw(id)));
}

export function isTeacher(state: Stored, token: string) {
  return !!token && state.teacherToken === token;
}

export function publicState(state: Stored, teacher: boolean): LiveState {
  // 샘플 강의로 열린 수업이면 실습 안내문을 파일에서 붙여 준다.
  // 저장된 덱에 넣어두지 않기 때문에, 안내문을 고치면 이미 열려 있는 수업에도 바로 반영된다.
  const sample = state.session.pdfKey === SAMPLE.pdf;

  return {
    session: state.session, revision: state.revision, responses: state.responses,
    posts: state.posts ?? [],
    surveyResponses: state.surveyResponses ?? [],
    wordResponses: state.wordResponses ?? [],
    reactions: (state.reactions ?? []).filter(r => Date.now() - r.createdAt < 5000),
    deck: state.deck && { ...state.deck, slides: state.deck.slides.map(slide => ({
      guide: sample && slide.kind === "lab" && slide.labNo !== null ? guideFor(slide.labNo) : slide.guide ?? null,
      // 파서를 고치기 전에 저장된 수업에는 퀴즈가 아닌 슬라이드에도 문항이 남아 있다.
      ...slide, items: (slide.kind === "quiz" ? slide.items : []).map(item => ({ ...item,
        hasAnswer: item.answers.length > 0,
        multiple: item.answers.length > 1,
        answers: teacher || (state.session.revealAnswer && slide.slideNo === state.session.currentSlide)
          ? item.answers : [],
      })),
    })) },
  };
}

/**
 * 그 슬라이드의 구성을 꺼낸다. 없으면 만들어 둔다.
 *
 * PDF만 올린 수업은 덱이 아예 없거나(제목을 못 뽑은 경우) 슬라이드 수가 모자랄 수 있다.
 * 강사가 "퀴즈 넣기"를 누른 자리에서 바로 만들어 줘야 교안 없이도 쓸 수 있다.
 */
function ensureSlide(state: Stored, id: string, slideNo: number): DeckSlide {
  if (!Number.isInteger(slideNo) || slideNo < 1) throw new Error("슬라이드 번호를 확인해 주세요.");

  const blank = (no: number): DeckSlide => ({
    slideNo: no, title: `슬라이드 ${no}`, kind: "normal", labNo: null, boardId: null, items: [],
  });

  if (!state.deck) {
    const total = Math.max(state.session.totalSlides, slideNo);
    state.deck = {
      sessionId: id, classId: null, source: "pdf", updatedAt: Date.now(),
      slides: Array.from({ length: total }, (_, i) => blank(i + 1)),
    };
  }

  let slide = state.deck.slides.find(s => s.slideNo === slideNo);
  if (!slide) {
    slide = blank(slideNo);
    state.deck.slides.push(slide);
    state.deck.slides.sort((a, b) => a.slideNo - b.slideNo);
  }
  return slide;
}

/** 명령 하나를 상태에 적용한다. 저장은 호출한 쪽이 한다. */
function apply(id: string, state: Stored, command: LiveCommand, teacher: boolean) {
    switch (command.action) {
    case "backup": break;
    case "importQuiz": {
      const slide=state.deck?.slides.find(s=>s.slideNo===command.slideNo);
      if(state.session.pdfKey!==command.pdfKey||!slide||slide.content||(slide.pdfPage??slide.slideNo)!==command.pdfPage)
        throw new Error("자료 구성이 바뀌었어요. 다시 불러와 주세요.");
      if(slide.items.length) break; // retries and simultaneous imports never overwrite existing questions
      if(!Array.isArray(command.items)||!command.items.length||command.items.length>10) throw new Error("퀴즈 문항을 확인해 주세요.");
      for(const item of command.items) {
        if(typeof item.question!=="string"||!item.question.trim()||item.question.length>2000||!Array.isArray(item.options)||item.options.length<2||item.options.length>9||item.options.some(o=>typeof o!=="string"||!o.trim()||o.length>1000)||!Array.isArray(item.answers)||!item.answers.length||item.answers.some(a=>!Number.isInteger(a)||a<0||a>=item.options.length)) throw new Error("퀴즈 문항과 정답을 확인해 주세요.");
      }
      slide.items=command.items.map((item,i)=>({...item,id:`ppt${command.slideNo}_${i+1}`,slideNo:command.slideNo,no:i+1}));
      slide.kind="quiz";
      break;
    }
    case "replaceMaterial": {
      if (!command.deck || !Array.isArray(command.deck.slides) || !command.deck.slides.length || command.deck.slides.length > 1000 ||
        typeof command.pdfKey !== "string" || !(/^(https:\/\/|\/api\/local-material\/)/.test(command.pdfKey))) throw new Error("교안 정보를 확인해 주세요.");
      state.deck = { ...command.deck, sessionId: id, updatedAt: Date.now() };
      state.responses = []; state.posts = []; state.reactions = []; state.wordResponses = []; state.surveyResponses = [];
      state.session = { ...initialSessionState, pdfKey: command.pdfKey, pdfName: command.name.slice(0, 200), totalSlides: command.deck.slides.length, currentSlide: 1 };
      break;
    }
    case "insertSlide": {
      if (!state.deck || !state.session.pdfKey) throw new Error("자료를 먼저 불러와 주세요.");
      if (state.deck.updatedAt !== command.expectedDeckUpdatedAt) throw new Error("수업 구성이 바뀌었어요. 추가 버튼을 다시 눌러 주세요.");
      const { content, anchor, side } = command;
      if (!Number.isInteger(anchor) || anchor < 1 || anchor > state.deck.slides.length || !["before", "after"].includes(side))
        throw new Error("추가할 위치를 확인해 주세요.");
      if (!content || !/^[a-zA-Z0-9_-]{8,100}$/.test(content.id) || state.deck.slides.some(s => s.content?.id === content.id))
        throw new Error("페이지 정보를 확인해 주세요.");
      if (content.type !== "image" && content.type !== "wordcloud" && content.type !== "survey") throw new Error("지원하지 않는 페이지입니다.");
      if (content.type === "image" && (typeof content.imageUrl !== "string" || !/^\/api\/image\/[a-z0-9]{8,64}$/.test(content.imageUrl)))
        throw new Error("이미지를 먼저 첨부해 주세요.");
      if (content.type === "wordcloud" && (typeof content.prompt !== "string" || !content.prompt.trim() || content.prompt.length > 160))
        throw new Error("질문을 160자 이내로 입력해 주세요.");
      if (typeof command.title !== "string" || !command.title.trim() || command.title.length > 160) throw new Error("제목을 확인해 주세요.");
      if (state.deck.slides.length >= 1000) throw new Error("수업에는 1,000장까지 넣을 수 있어요.");
      const at = anchor + (side === "after" ? 1 : 0);
      // 원본 페이지와 문항 ID는 유지하고 표시 순서와 위치 참조만 옮긴다.
      const slides = state.deck.slides.map(s => ({ ...s, ...(!s.content ? { pdfPage: s.pdfPage ?? s.slideNo } : {}) }));
      const cleanContent = content.type === "image"
        ? { id: content.id, type: "image" as const, imageUrl: content.imageUrl }
        : content.type === "survey" ? cleanSurvey(content) : { id: content.id, type: "wordcloud" as const, prompt: content.prompt.trim() };
      slides.splice(at - 1, 0, { slideNo: at, title: command.title.trim(), kind: "normal", labNo: null, boardId: null, items: [], content: cleanContent });
      state.deck.slides = slides.map((s, i) => ({ ...s, slideNo: i + 1, items: s.items.map(q => ({ ...q, slideNo: i + 1 })) }));
      state.posts = state.posts.map(p => ({ ...p, slideNo: p.slideNo >= at ? p.slideNo + 1 : p.slideNo }));
      state.reactions = [];
      state.deck.updatedAt = Math.max(Date.now(), state.deck.updatedAt + 1);
      state.session.totalSlides = slides.length;
      state.session.currentSlide = at;
      state.session.revealAnswer = false;
      state.session.activeActivityId = null;
      break;
    }
    case "surveyRespond": {
      const content = state.deck?.slides.find(s => s.slideNo === state.session.currentSlide)?.content;
      if (content?.type !== "survey" || content.id !== command.slideId) throw new Error("현재 질문에만 참여할 수 있어요.");
      const response = cleanSurveyResponse(content, command);
      const others = (state.surveyResponses ?? []).filter(r => !(r.slideId === content.id && r.responderId === command.responderId));
      if (others.filter(r => r.slideId === content.id).length >= 200) throw new Error("이 페이지에는 200명까지 참여할 수 있어요.");
      state.surveyResponses = [...others, response];
      break;
    }
    case "wordRespond": {
      const content = state.deck?.slides.find(s => s.slideNo === state.session.currentSlide)?.content;
      if (content?.type !== "wordcloud" || content.id !== command.slideId) throw new Error("현재 워드클라우드에만 참여할 수 있어요.");
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(command.responderId) || typeof command.word !== "string") throw new Error("응답을 확인해 주세요.");
      const word = command.word.normalize("NFKC").trim().replace(/\s+/g, " ");
      if (!word || Array.from(word).length > 20 || /[\u0000-\u001f\u007f]/.test(word)) throw new Error("단어 또는 짧은 표현을 20자 이내로 입력해 주세요.");
      const others = (state.wordResponses ?? []).filter(r => !(r.slideId === content.id && r.responderId === command.responderId));
      if (others.filter(r => r.slideId === content.id).length >= 200) throw new Error("이 페이지에는 200명까지 참여할 수 있어요.");
      state.wordResponses = [...others, { slideId: content.id, responderId: command.responderId, word }];
      break;
    }
    case "react": {
      if (!state.session.pdfKey || command.slideNo !== state.session.currentSlide)
        throw new Error("현재 슬라이드에서만 반응할 수 있어요.");
      if (!REACTIONS.some(r => r.emoji === command.emoji) || !/^[a-zA-Z0-9_-]{1,100}$/.test(command.senderId))
        throw new Error("반응을 확인해 주세요.");
      const now = Date.now();
      const recent = (state.reactions ?? []).filter(r => now - r.createdAt < 5000);
      state.reactions = [...recent.slice(-79), { id: crypto.randomUUID(), slideNo: command.slideNo,
        emoji: command.emoji, senderId: command.senderId, createdAt: now }];
      break;
    }
    case "sample": {
      const parsed = parseDeckMarkdown(readFileSync(path.join(process.cwd(), SAMPLE.deck), "utf8"));
      // 교안은 본문 첫 장이 1번인데, PDF에는 출석 확인·표지 두 장이 앞에 더 있다.
      // 슬라이드 번호가 곧 PDF 페이지 번호이므로 교안 쪽을 밀어서 맞춘다.
      const shifted = parsed.map((s) => ({
        ...s,
        slideNo: s.slideNo + SAMPLE.intro.length,
        items: s.items.map((i) => ({ ...i, slideNo: i.slideNo + SAMPLE.intro.length })),
      }));
      const intro: DeckSlide[] = SAMPLE.intro.map((title, i) => ({
        slideNo: i + 1, title, kind: "normal", labNo: null, boardId: null, items: [],
      }));
      // 실습 안내문은 여기서 넣지 않는다 — publicState가 읽을 때 파일에서 붙인다.
      // 게시판에는 강사 예시를 하나씩 올려둔다.
      const slides = [...intro, ...shifted];
      state.deck = { sessionId: id, classId: null, slides, source: "md", updatedAt: Date.now() };
      state.responses = [];
      state.reactions = [];
      state.wordResponses = []; state.surveyResponses = [];
      state.posts = seedPostsFor(slides.filter((s) => s.kind === "lab"));
      state.session = { ...initialSessionState, pdfKey: SAMPLE.pdf, pdfName: SAMPLE.name,
        totalSlides: SAMPLE.intro.length + parsed.length, currentSlide: 1 };
      break;
    }
    case "patch": {
      const p = command.partial;
      if (p.currentSlide !== undefined && (!Number.isInteger(p.currentSlide) || p.currentSlide < 1 ||
        (state.session.totalSlides > 0 && p.currentSlide > state.session.totalSlides))) throw new Error("슬라이드 번호를 확인해 주세요.");
      if (p.totalSlides !== undefined && (!Number.isInteger(p.totalSlides) || p.totalSlides < 0)) throw new Error("슬라이드 수를 확인해 주세요.");
      state.session = { ...state.session, ...p };
      if (p.currentSlide !== undefined) state.session.revealAnswer = false;
      break;
    }
    case "deck":
      state.deck = command.deck;
      state.responses = [];
      state.surveyResponses = (state.surveyResponses ?? []).filter(r => command.deck?.slides.some(s => s.content?.id === r.slideId));
      state.wordResponses = (state.wordResponses ?? []).filter(r => command.deck?.slides.some(s => s.content?.id === r.slideId));
      break;
    case "class": if (state.deck) state.deck.classId = command.classId; break;
    case "board": {
      const slide = state.deck?.slides.find(s => s.slideNo === command.slideNo);
      if (slide) slide.boardId = command.boardId;
      break;
    }
    case "respond": {
      const item = state.deck?.slides.find(s => s.slideNo === state.session.currentSlide)?.items.find(q => q.id === command.itemId);
      if (!item || (state.session.revealAnswer && item.answers.length > 0)) throw new Error("지금 답할 수 있는 문항이 아닙니다.");
      const choices = command.choiceIndices ?? [command.choiceIndex];
      if (!Array.isArray(choices) || choices.some(i => !Number.isInteger(i) || i < 0 || i >= item.options.length) ||
        new Set(choices).size !== choices.length || (item.answers.length <= 1 && choices.length > 1) ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(command.responderId)) throw new Error("응답을 확인해 주세요.");
      state.responses = state.responses.filter(r => !(r.itemId === item.id && r.responderId === command.responderId));
      if (choices.length) state.responses.push({ itemId: item.id, responderId: command.responderId, choiceIndex: choices[0], choiceIndices: choices, createdAt: Date.now() });
      break;
    }
    case "reset": state.responses = state.responses.filter(r => r.itemId !== command.itemId); break;

    // ── 교안 없이 강사가 직접 넣는 것들 ──────────────────────────────
    case "addItem": {
      const slide = ensureSlide(state, id, command.slideNo);
      const question = command.question.trim().slice(0, 300);
      const options = command.options.map(o => o.trim().slice(0, 200)).filter(Boolean);
      if (!question) throw new Error("질문을 입력해 주세요.");
      if (options.length < 2) throw new Error("선택지를 두 개 이상 입력해 주세요.");
      if (options.length > 9) throw new Error("선택지는 아홉 개까지 넣을 수 있어요.");
      if (slide.items.length >= 10) throw new Error("한 슬라이드에는 문항을 열 개까지 넣을 수 있어요.");
      const answers = [...new Set(command.answers)]
        .filter(i => Number.isInteger(i) && i >= 0 && i < options.length)
        .sort((a, b) => a - b);
      const no = slide.items.length + 1;
      slide.items.push({
        id: `m${command.slideNo}_${no}_${Date.now().toString(36)}`,
        slideNo: command.slideNo, no, question, options, answers,
      });
      // 실습 슬라이드에 문항을 얹는 경우도 있으니 실습 표시는 건드리지 않는다
      if (slide.kind === "normal") slide.kind = "quiz";
      break;
    }
    case "removeItem": {
      const slide = state.deck?.slides.find(s => s.slideNo === command.slideNo);
      if (!slide) break;
      slide.items = slide.items.filter(i => i.id !== command.itemId);
      state.responses = state.responses.filter(r => r.itemId !== command.itemId);
      if (slide.kind === "quiz" && slide.items.length === 0) slide.kind = "normal";
      break;
    }
    case "markLab": {
      const slide = ensureSlide(state, id, command.slideNo);
      if (command.labNo === null) {
        slide.kind = slide.items.length > 0 ? "quiz" : "normal";
        slide.labNo = null;
        slide.boardId = null;
        break;
      }
      if (!Number.isInteger(command.labNo) || command.labNo < 0 || command.labNo > 999)
        throw new Error("실습 번호를 확인해 주세요.");
      slide.kind = "lab";
      slide.labNo = command.labNo;
      break;
    }
    case "guide": {
      const slide = state.deck?.slides.find(s => s.slideNo === command.slideNo);
      if (!slide || slide.kind !== "lab") throw new Error("실습 슬라이드를 먼저 선택해 주세요.");
      if (typeof command.markdown !== "string" || !command.markdown.trim())
        throw new Error("가이드 내용이 비어 있어요.");
      if (Buffer.byteLength(command.markdown, "utf8") > 200 * 1024)
        throw new Error("가이드는 200KB 이하로 올려주세요.");
      slide.guide = command.markdown.replace(/^\uFEFF/, "").trim();
      if (state.deck) state.deck.updatedAt = Date.now();
      break;
    }

    // ── 실습 결과물 ─────────────────────────────────────────────────
    case "addPost": {
      const slide = state.deck?.slides.find(s => s.slideNo === command.slideNo);
      if (!slide || slide.kind !== "lab") throw new Error("실습 슬라이드가 아니에요.");
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(command.ownerId)) throw new Error("올린 사람을 확인하지 못했어요.");
      const description = command.description.trim().slice(0, 2000);
      const imageUrl = command.imageUrl?.trim() ?? null;
      if (!description && !imageUrl) throw new Error("설명을 적거나 이미지를 올려주세요.");
      // 이미지는 이 서버가 내주는 주소만 받는다 (바깥 주소를 그대로 띄우지 않는다)
      if (imageUrl && !/^\/(api\/image\/[a-z0-9]{8,64}|samples\/gallery\/lab-\d+\.png)$/.test(imageUrl))
        throw new Error("이미지 주소를 확인해 주세요.");
      if (state.posts.filter(p => p.slideNo === command.slideNo).length >= 200)
        throw new Error("이 실습에는 결과물이 너무 많아요.");
      state.posts.push({
        id: `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        slideNo: command.slideNo,
        authorName: command.authorName.trim().slice(0, 40),
        description, imageUrl, ownerId: command.ownerId, likes: [], createdAt: Date.now(),
      });
      break;
    }
    case "likePost": {
      const post = state.posts.find(p => p.id === command.postId);
      if (!post) throw new Error("결과물을 찾지 못했어요.");
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(command.ownerId)) throw new Error("누가 눌렀는지 확인하지 못했어요.");
      const likes = post.likes ?? [];
      // 다시 누르면 취소 — 한 사람이 여러 번 눌러도 하나로 센다
      post.likes = likes.includes(command.ownerId)
        ? likes.filter(l => l !== command.ownerId)
        : [...likes, command.ownerId];
      break;
    }
    case "removePost": {
      const post = state.posts.find(p => p.id === command.postId);
      if (!post) break;
      // 강사는 무엇이든 지울 수 있고, 학생은 자기가 올린 것만. 예시는 아무도 못 지운다.
      if (post.ownerId === SEED_OWNER) throw new Error("강사 예시는 지울 수 없어요.");
      if (!teacher && post.ownerId !== command.ownerId) throw new Error("내가 올린 결과물만 지울 수 있어요.");
      state.posts = state.posts.filter(p => p.id !== command.postId);
      break;
    }
    default: throw new Error("지원하지 않는 요청입니다.");
  }
}

export async function execute(id: string, token: string, command: LiveCommand): Promise<LiveState> {
  if (!validId(id)) throw new Error("올바르지 않은 세션 코드입니다.");

  // 다른 응답이 먼저 저장되면 우리 쓰기가 거절된다 — 최신 상태를 다시 읽어 얹고 재시도한다.
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    const raw = await kv().get(key(id));
    const state: Stored = parse(raw) ?? (() => {
      if (STUDENT_ACTIONS.has(command.action) || !/^[a-zA-Z0-9_-]{20,100}$/.test(token))
        throw new Error("열린 수업을 찾지 못했습니다.");
      return { session: { ...initialSessionState }, deck: null, responses: [], posts: [], revision: 0, teacherToken: token } satisfies Stored;
    })();
    // 이 수업이 열리기 전 형식으로 저장돼 있을 수 있다
    state.posts ??= [];

    const teacher = isTeacher(state, token);
    if (!STUDENT_ACTIONS.has(command.action) && !teacher)
      throw new Error("이 수업을 연 강사 화면에서만 변경할 수 있습니다.");

    const destructive = ["sample", "replaceMaterial", "deck", "reset", "removeItem", "removePost", "guide"].includes(command.action);
    if (command.action === "backup" && (!state.deck || state.backupRevision === state.revision)) return publicState(state, teacher);
    if (state.deck && (destructive || command.action === "backup" || Date.now() - (state.backupAt ?? 0) >= BACKUP_INTERVAL)) {
      // Await durable storage BEFORE any reset. A failed backup blocks the reset.
      await saveBackup(id, state, destructive ? `변경 전: ${command.action}` : "자동 저장");
      state.backupAt = Date.now();
      state.backupRevision = command.action === "backup" ? state.revision + 1 : state.revision;
    }
    apply(id, state, command, teacher);
    state.revision += 1;
    state.session.updatedAt = Date.now();

    const next = JSON.stringify(state);
    if (await kv().compareAndSet(key(id), raw, next)) {
      // 방금 쓴 값을 그대로 기억해 둔다 — 바로 뒤에 오는 폴링이 저장소를 또 열지 않게
      cachedReads.set(id, { at: Date.now(), raw: next });
      return publicState(state, teacher);
    }
    forget(id);
  }

  throw new Error("같은 순간에 요청이 몰렸어요. 다시 한 번 눌러 주세요.");
}

