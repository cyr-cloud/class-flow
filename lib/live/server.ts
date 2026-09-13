import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import path from "node:path";
import { initialSessionState } from "../sync/types";
import { parseDeckMarkdown } from "../lecture/parseDeck";
import type { LiveState, LiveCommand } from "./types";

interface Stored extends LiveState { teacherToken: string }
const folder = path.join(process.cwd(), ".classflow", "sessions");
export function validId(id: string) { return /^[a-zA-Z0-9_-]{1,64}$/.test(id); }
export function readSession(id: string): Stored | null {
  if (!validId(id)) return null;
  const file = path.join(folder, `${id}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as Stored : null;
}
export function isTeacher(state: Stored, token: string) {
  return !!token && state.teacherToken === token;
}
export function publicState(state: Stored, teacher: boolean): LiveState {
  return {
    session: state.session, revision: state.revision, responses: state.responses,
    deck: state.deck && { ...state.deck, slides: state.deck.slides.map(slide => ({
      ...slide, items: slide.items.map(item => ({ ...item,
        hasAnswer: item.answers.length > 0,
        multiple: item.answers.length > 1,
        answers: teacher || (state.session.revealAnswer && slide.slideNo === state.session.currentSlide)
          ? item.answers : [],
      })),
    })) },
  };
}
// Synchronous read-modify-rename keeps concurrent votes atomic in this single Node server.
// Files survive development reloads and restarts; multi-instance hosting needs a shared database.
export function execute(id: string, token: string, command: LiveCommand): LiveState {
  if (!validId(id)) throw new Error("올바르지 않은 세션 코드입니다.");
  let state = readSession(id);
  if (!state) {
    if (command.action === "respond" || !/^[a-zA-Z0-9_-]{20,100}$/.test(token))
      throw new Error("열린 수업을 찾지 못했습니다.");
    state = { session: { ...initialSessionState }, deck: null, responses: [], revision: 0, teacherToken: token };
  }
  const teacher = isTeacher(state, token);
  if (command.action !== "respond" && !teacher) throw new Error("이 수업을 연 강사 화면에서만 변경할 수 있습니다.");
  switch (command.action) {
    case "sample": {
      const slides = parseDeckMarkdown(readFileSync(path.join(process.cwd(), "data/samples/yuko-agit-02.md"), "utf8"));
      for (const slide of slides) {
        for (const item of slide.items) {
          if (/^답을 채팅/.test(item.question)) {
            item.question = slide.title.replace(/^퀴즈\s*\d+\s*[—-]\s*/, "") + (item.answers.length > 1 ? " (복수 선택)" : "");
          }
        }
      }
      // PDF pages 1–40 match the source; page 41 is its additional closing slide.
      slides.push({ slideNo: 41, title: "경청해 주셔서 감사합니다", kind: "normal", labNo: null, boardId: null, items: [] });
      state.deck = { sessionId: id, classId: null, slides, source: "md", updatedAt: Date.now() };
      state.responses = [];
      state.session = { ...initialSessionState, pdfKey: "/samples/yuko-agit-02-claude-prompting.pdf",
        pdfName: "유코의 아지트 2회 (샘플)", totalSlides: slides.length, currentSlide: 1 };
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
      break;
    case "class": if (state.deck) state.deck.classId = command.classId; break;
    case "board": {
      const slide = state.deck?.slides.find(s => s.slideNo === command.slideNo);
      if (slide) slide.boardId = command.boardId;
      break;
    }
    case "respond": {
      const item = state.deck?.slides.find(s => s.slideNo === state.session.currentSlide)?.items.find(q => q.id === command.itemId);
      if (!item || state.session.revealAnswer) throw new Error("지금 답할 수 있는 문항이 아닙니다.");
      const choices = command.choiceIndices ?? [command.choiceIndex];
      if (!Array.isArray(choices) || choices.some(i => !Number.isInteger(i) || i < 0 || i >= item.options.length) ||
        new Set(choices).size !== choices.length || (item.answers.length <= 1 && choices.length > 1) ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(command.responderId)) throw new Error("응답을 확인해 주세요.");
      state.responses = state.responses.filter(r => !(r.itemId === item.id && r.responderId === command.responderId));
      if (choices.length) state.responses.push({ itemId: item.id, responderId: command.responderId, choiceIndex: choices[0], choiceIndices: choices, createdAt: Date.now() });
      break;
    }
    case "reset": state.responses = state.responses.filter(r => r.itemId !== command.itemId); break;
    default: throw new Error("지원하지 않는 요청입니다.");
  }
  state.revision += 1;
  state.session.updatedAt = Date.now();
  mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${id}.json`);
  writeFileSync(`${file}.tmp`, JSON.stringify(state));
  renameSync(`${file}.tmp`, file);
  return publicState(state, teacher);
}
