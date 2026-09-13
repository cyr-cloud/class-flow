"use client";

// 강사용 진행 화면.
// 슬라이드를 넘기면 patch()로 상태가 전파되어 학생 화면이 따라온다.
// PDF와 함께 교안 마크다운을 올리면 실습·퀴즈 슬라이드를 알아보고, 그 자리에서
// 참여요소를 열고 응답 현황을 본다. 실습 슬라이드는 실습 게시판과 연결된다.

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import SlideStage from "./lecture/SlideStage";
import SlideActivities from "./lecture/SlideActivities";
import PresentView from "./lecture/PresentView";
import { savePdf } from "@/lib/sync/pdfStore";
import { useSync } from "@/lib/sync/useSync";
import { deckFromTitles, parseDeckMarkdown } from "@/lib/lecture/parseDeck";
import { extractTitles } from "@/lib/lecture/pdfTitles";
import { deckStore, useCurrentSlide, useDeckState, useLabSlides } from "@/lib/lecture/useDeck";
import { boardStore } from "@/lib/board/useBoard";
import { Deck } from "@/lib/types";
import { liveClient } from "@/lib/live/client";
import LiveStatus from "./lecture/LiveStatus";

const noSubscribe = () => () => {};
const emptyString = () => "";

export default function TeacherView({ sessionId }: { sessionId: string }) {
  const { state, patch } = useSync(sessionId);
  const { deck, responses } = useDeckState(sessionId);
  const slide = useCurrentSlide(sessionId, state.currentSlide);
  const labSlides = useLabSlides(sessionId);

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [presenting, setPresenting] = useState(false);

  // location은 React 밖의 값이라 외부 스토어로 읽는다 (effect 안 setState 회피)
  const studentUrl = useSyncExternalStore(
    noSubscribe,
    useCallback(() => `${window.location.origin}/student/${sessionId}`, [sessionId]),
    emptyString,
  );

  const saveDeck = useCallback(
    (slides: Deck["slides"], source: Deck["source"]) => {
      // 교안을 다시 올려도 이미 연결해 둔 실습 게시판은 유지한다 (실습 번호로 이어붙인다)
      const linked = new Map(
        (deck?.slides ?? [])
          .filter((s) => s.boardId)
          .map((s) => [s.labNo ?? `slide${s.slideNo}`, s.boardId] as const),
      );
      deckStore.setDeck(sessionId, {
        sessionId,
        classId: deck?.classId ?? null,
        slides: slides.map((s) => ({
          ...s,
          boardId: s.boardId ?? linked.get(s.labNo ?? `slide${s.slideNo}`) ?? null,
        })),
        source,
        updatedAt: Date.now(),
      });
    },
    [sessionId, deck],
  );

  const storeAndUse = useCallback(
    async (buf: ArrayBuffer, name: string) => {
      const key = `${sessionId}:${crypto.randomUUID()}`;
      await savePdf(key, buf);
      patch({
        pdfKey: key,
        pdfName: name,
        currentSlide: 1,
        totalSlides: 0,
        activeActivityId: null,
        revealAnswer: false,
      });
      // 교안 md가 아직 없으면 PDF 제목만으로 실습·퀴즈를 먼저 알아본다
      if (!deck || deck.source === "pdf") {
        const titles = await extractTitles(key);
        if (titles.some((t) => t.trim())) saveDeck(deckFromTitles(titles), "pdf");
      }
    },
    [sessionId, patch, deck, saveDeck],
  );

  /** PDF는 그대로, PPT는 서버(LibreOffice)에서 PDF로 바꿔서 쓴다 */
  const onSlideFile = useCallback(
    async (file: File) => {
      setBusy("pdf");
      setNotice("");
      try {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (isPdf) {
          await storeAndUse(await file.arrayBuffer(), file.name);
          return;
        }

        setNotice(`${file.name} 을(를) PDF로 바꾸는 중이에요… 파일이 크면 조금 걸립니다.`);
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/convert", { method: "POST", body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setNotice(body?.error ?? "PPT를 PDF로 바꾸지 못했어요. 직접 PDF로 저장해서 올려주세요.");
          return;
        }
        await storeAndUse(await res.arrayBuffer(), file.name.replace(/\.[^.]+$/, ".pdf"));
        setNotice("");
      } finally {
        setBusy("");
      }
    },
    [storeAndUse],
  );

  const onOutline = useCallback(
    async (file: File) => {
      setBusy("outline");
      try {
        const slides = parseDeckMarkdown(await file.text());
        if (slides.length === 0) {
          setNotice("교안에서 «## 슬라이드 N: 제목» 형식을 찾지 못했어요.");
          return;
        }
        saveDeck(slides, "md");
        const labs = slides.filter((s) => s.kind === "lab").length;
        const quizzes = slides.reduce((n, s) => n + s.items.length, 0);
        setNotice(`슬라이드 ${slides.length}장 · 실습 ${labs}개 · 참여요소 ${quizzes}문항을 읽었어요.`);
      } finally {
        setBusy("");
      }
    },
    [saveDeck],
  );

  // public/samples 에 넣어둔 강의자료. 바꾸려면 이 경로만 고치면 된다.
  const loadSample = useCallback(async () => {
    setBusy("pdf");
    try {
      await liveClient(sessionId).send({ action: "sample" });
      const loaded = liveClient(sessionId).snapshot().deck;
      setNotice(`유코의 아지트 2회 · ${loaded?.slides.length ?? 0}장 · 참여요소 ${loaded?.slides.reduce((n, s) => n + s.items.length, 0) ?? 0}문항을 준비했어요. 학생 입장 링크로 바로 참여할 수 있어요.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "샘플을 불러오지 못했어요.");
    } finally {
      setBusy("");
    }
  }, [sessionId]);

  /** 감지된 실습마다 게시판을 만들고 슬라이드에 연결 */
  const buildBoards = useCallback(() => {
    if (!deck) return;
    let classId = deck.classId;
    if (!classId) {
      const title = state.pdfName?.replace(/\.pdf$/i, "") || `수업 ${sessionId}`;
      classId = boardStore.createClass(title).id;
      deckStore.setClassId(sessionId, classId);
    }
    let made = 0;
    for (const s of labSlides) {
      if (s.boardId) continue;
      const board = boardStore.createBoard(classId, {
        no: s.labNo ?? undefined,
        title: `실습 ${s.labNo}: ${s.title}`,
      });
      deckStore.linkBoard(sessionId, s.slideNo, board.id);
      made += 1;
    }
    setNotice(made ? `실습 게시판 ${made}개를 만들었어요.` : "이미 다 연결되어 있어요.");
  }, [deck, labSlides, sessionId, state.pdfName]);

  const go = useCallback(
    (delta: number) => {
      const total = state.totalSlides || 1;
      const next = Math.min(Math.max(1, state.currentSlide + delta), total);
      if (next !== state.currentSlide) patch({ currentSlide: next, revealAnswer: false });
    },
    [state.currentSlide, state.totalSlides, patch],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const stopPresenting = useCallback(() => setPresenting(false), []);

  const hasItems = (slide?.items.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-14 z-20 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-4">
          <div className="min-w-0">
            <p className="eyebrow">강사 화면</p>
            <h1 className="truncate text-lg font-bold text-ink">
              {state.pdfName ?? "슬라이드를 올려주세요"}
            </h1>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label
              title="교안 마크다운(slide-content.md) — 퀴즈 문항·선택지·정답을 읽어옵니다"
              className="cursor-pointer rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
            >
              {busy === "outline" ? "읽는 중…" : "교안 불러오기"}
              <input
                type="file"
                accept=".md,text/markdown"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onOutline(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={loadSample}
              disabled={busy !== ""}
              title="유코의 아지트 2회 PDF와 교안 퀴즈를 함께 불러옵니다"
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-40"
            >
              샘플
            </button>
            <label
              title="PPT(.pptx/.ppt) 또는 PDF. PPT는 올리면 자동으로 PDF로 바꿔서 씁니다"
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
            >
              {busy === "pdf"
                ? "불러오는 중…"
                : state.pdfKey
                  ? "슬라이드 교체"
                  : "슬라이드 올리기"}
              <input
                type="file"
                accept=".pdf,.pptx,.ppt,.odp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onSlideFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <LiveStatus sessionId={sessionId} />
        {notice && (
          <p className="mb-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
            {notice}
          </p>
        )}

        {/* 슬라이드 */}
        <div className="overflow-hidden rounded-2xl border border-line bg-paper p-3">
          <SlideStage
            sessionId={sessionId}
            pdfKey={state.pdfKey}
            page={state.currentSlide}
            canDraw
            onLoaded={(total) => {
              if (total !== state.totalSlides) patch({ totalSlides: total });
            }}
          />
        </div>

        {/* 넘김 조작 */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => go(-1)}
            disabled={state.currentSlide <= 1}
            className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-30"
          >
            ← 이전
          </button>
          <span className="tabular-nums text-sm text-mute">
            {state.totalSlides ? `${state.currentSlide} / ${state.totalSlides}` : "–"}
          </span>
          <button
            onClick={() => go(1)}
            disabled={!!state.totalSlides && state.currentSlide >= state.totalSlides}
            className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-30"
          >
            다음 →
          </button>

          {slide && (
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{slide.title}</span>
          )}

          {hasItems && (
            <button
              onClick={() => patch({ revealAnswer: !state.revealAnswer })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                state.revealAnswer
                  ? "bg-tendril text-white"
                  : "border border-line-strong text-ink-soft hover:border-mocha hover:text-mocha"
              }`}
            >
              {state.revealAnswer ? "정답 숨기기" : "정답 공개"}
            </button>
          )}

          {state.pdfKey && (
            <button
              onClick={() => setPresenting(true)}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
            >
              전체화면 발표
            </button>
          )}
        </div>

        <SlideActivities
          sessionId={sessionId}
          slide={slide}
          classId={deck?.classId ?? null}
          responses={responses}
          role="teacher"
          reveal={state.revealAnswer}
        />

        {/* 강의 구성 요약 */}
        {deck && (
          <section className="mt-8 rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="eyebrow">강의 구성</p>
              <p className="text-sm text-ink-soft">
                슬라이드 {deck.slides.length}장 · 실습 {labSlides.length}개 · 참여요소{" "}
                {deck.slides.reduce((n, s) => n + s.items.length, 0)}문항
                {deck.source === "pdf" && " (PDF 제목으로 감지)"}
              </p>
              <div className="ml-auto flex items-center gap-2">
                {deck.classId && (
                  <Link
                    href={`/board/${deck.classId}`}
                    className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
                  >
                    게시판 목록
                  </Link>
                )}
                {labSlides.length > 0 && (
                  <button
                    onClick={buildBoards}
                    className="rounded-full bg-mocha px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
                  >
                    실습 게시판 만들기
                  </button>
                )}
              </div>
            </div>

            <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              퀴즈·참여 문항 바로가기
              <select
                aria-label="퀴즈·참여 문항 바로가기"
                value={deck.slides.some(s => s.slideNo === state.currentSlide && s.items.length) ? state.currentSlide : ""}
                onChange={e => { if (e.target.value) patch({ currentSlide: Number(e.target.value), revealAnswer: false }); }}
                className="min-w-0 max-w-full rounded-lg border border-line bg-cream px-3 py-2"
              >
                <option value="">문항을 선택해 주세요</option>
                {deck.slides.filter(s => s.items.length > 0).map(s => <option key={s.slideNo} value={s.slideNo}>{s.slideNo}쪽 · {s.title} ({s.items.length}문항)</option>)}
              </select>
            </label>
            {labSlides.length > 0 && (
              <ul className="mt-4 grid gap-1 sm:grid-cols-2">
                {labSlides.map((s) => (
                  <li key={s.slideNo}>
                    <button
                      onClick={() => patch({ currentSlide: s.slideNo, revealAnswer: false })}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gardenia"
                    >
                      <span className="w-14 shrink-0 text-mute">실습 {s.labNo}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                      <span
                        className={`shrink-0 text-xs ${s.boardId ? "text-tendril" : "text-mute"}`}
                      >
                        {s.boardId ? "게시판 ●" : "미연결"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 학생 링크 */}
        {studentUrl && (
          <section className="mt-6 rounded-2xl border border-line bg-gardenia/60 p-5">
            <p className="eyebrow">학생 입장 링크</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-3 py-2 font-mono text-sm text-ink-soft">
                {studentUrl}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(studentUrl)}
                className="shrink-0 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm text-ink-soft hover:border-mocha hover:text-mocha"
              >
                복사
              </button>
            </div>
            <p className="mt-2 text-xs text-mute">
              샘플의 슬라이드와 퀴즈 응답은 같은 서버에 접속한 기기끼리 공유됩니다.
              다른 기기에는 localhost 대신 이 컴퓨터의 네트워크 주소로 접속한 링크를 전달해 주세요.
            </p>
          </section>
        )}
      </main>

      {presenting && (
        <PresentView
          sessionId={sessionId}
          pdfKey={state.pdfKey}
          page={state.currentSlide}
          total={state.totalSlides}
          slide={slide}
          classId={deck?.classId ?? null}
          responses={responses}
          role="teacher"
          reveal={state.revealAnswer}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onToggleReveal={() => patch({ revealAnswer: !state.revealAnswer })}
          onClose={stopPresenting}
        />
      )}
    </div>
  );
}
