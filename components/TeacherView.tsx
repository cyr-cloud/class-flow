"use client";

// 강사용 진행 화면.
// 슬라이드를 넘기면 patch()로 상태가 전파되어 학생 화면이 따라온다.
// PDF와 함께 교안 마크다운을 올리면 실습·퀴즈 슬라이드를 알아보고, 그 자리에서
// 참여요소를 열고 응답 현황을 본다. 실습 슬라이드는 실습 게시판과 연결된다.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import SlideStage from "./lecture/SlideStage";
import SlideActivities from "./lecture/SlideActivities";
import SlideComposer from "./lecture/SlideComposer";
import PresentView from "./lecture/PresentView";
import { savePdf } from "@/lib/sync/pdfStore";
import { useSync } from "@/lib/sync/useSync";
import { deckFromTitles, slideKindOf } from "@/lib/lecture/parseDeck";
import { extractTitles } from "@/lib/lecture/pdfTitles";
import { deckStore, useCurrentSlide, useDeckState, useLabSlides } from "@/lib/lecture/useDeck";
import { Deck, QuizItem } from "@/lib/types";
import { liveClient } from "@/lib/live/client";
import LiveStatus from "./lecture/LiveStatus";
import OnboardingModal from "./lecture/OnboardingModal";

const noSubscribe = () => () => {};
const emptyString = () => "";

export default function TeacherView({ sessionId }: { sessionId: string }) {
  const { state, patch } = useSync(sessionId);
  const { deck, responses, posts } = useDeckState(sessionId);
  const slide = useCurrentSlide(sessionId, state.currentSlide);
  const labSlides = useLabSlides(sessionId);

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  // 올린 PPT 원본. 발표자 노트를 읽으려면 PDF가 아니라 이 파일이 필요하다
  const [pptx, setPptx] = useState<File | null>(null);
  // 샘플 강의는 노트를 서버에 넣어두어서, PPT를 올리지 않아도 AI로 뽑아볼 수 있다
  const isSample = state.pdfKey?.startsWith("/samples/") ?? false;

  /**
   * 내 자료 올리기는 아직 로컬에서만 된다.
   * - PPT→PDF 변환은 이 컴퓨터에 깔린 LibreOffice가 한다 (배포 환경엔 설치할 수 없다)
   * - 올린 PDF는 강사 브라우저(IndexedDB)에만 저장돼서 학생 기기에는 전달되지 않는다
   * 서버에 PDF를 올리도록 고치기 전까지는 배포본에서 막아둔다 — 되는 척하는 것보다 낫다.
   */
  const canUpload = !process.env.NEXT_PUBLIC_VERCEL_ENV;
  const [jumpTo, setJumpTo] = useState("");
  const [presenting, setPresenting] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // location은 React 밖의 값이라 외부 스토어로 읽는다 (effect 안 setState 회피)
  const studentUrl = useSyncExternalStore(
    noSubscribe,
    useCallback(() => `${window.location.origin}/student/${sessionId}`, [sessionId]),
    emptyString,
  );

  const copyStudentLink = async () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(studentUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    copyTimer.current = setTimeout(() => setCopyStatus("idle"), 2500);
  };

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
      return key;
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
        const key = await storeAndUse(await res.arrayBuffer(), file.name.replace(/\.[^.]+$/, ".pdf"));
        // 원본을 들고 있어야 나중에 발표자 노트에서 문항을 뽑을 수 있다
        setPptx(file);
        setNotice("슬라이드를 불러왔어요.");
        return key;
      } finally {
        setBusy("");
      }
    },
    [storeAndUse],
  );

  /**
   * 슬라이드 한 장의 발표자 노트(강의 대본)를 읽어 문항을 만든다.
   * 제목만으로는 «여기 퀴즈가 있다»까지만 알 수 있고, 문항·선택지·정답은 대본에 있다.
   */
  const askFor = useCallback(
    async (slideNo: number, source: File | "sample", titles: string[]) => {
      const form = new FormData();
      if (source === "sample") form.append("sample", "true");
      else form.append("file", source);
      form.append("slideNos", JSON.stringify([slideNo]));
      form.append("titles", JSON.stringify(titles));

      const res = await fetch("/api/extract-quiz", { method: "POST", body: form });
      const body = (await res.json()) as { items?: QuizItem[]; error?: string };
      if (!res.ok || !body.items) throw new Error(body.error ?? "문항을 뽑지 못했어요.");
      return body.items;
    },
    [],
  );

  /** 만든 문항을 그 슬라이드에만 얹는다 */
  const attach = useCallback(
    (made: Map<number, QuizItem[]>) => {
      saveDeck(
        (deck?.slides ?? []).map((s) => {
          const items = made.get(s.slideNo);
          if (!items?.length) return s;
          return {
            ...s,
            kind: s.kind === "normal" ? "quiz" : s.kind,
            items: [
              ...s.items,
              ...items.map((item, i) => ({
                ...item,
                id: `ai${s.slideNo}_${Date.now().toString(36)}_${i}`,
                slideNo: s.slideNo,
                no: s.items.length + i + 1,
              })),
            ],
          };
        }),
        deck?.source ?? "pdf",
      );
    },
    [deck, saveDeck],
  );

  /**
   * 제목에 «퀴즈»가 있는 슬라이드는 올리자마자 문항까지 만들어 둔다.
   * 강사가 한 장씩 눌러줄 필요 없이 확인만 하면 되게 하려는 것.
   * 나머지 슬라이드는 그 자리에서 «✦ 대본으로 만들기»로 만든다.
   */
  const prefillQuizzes = useCallback(
    async (file: File, pdfKey: string) => {
      const titles = await extractTitles(pdfKey);
      const quizSlides = titles
        .map((t, i) => ({ no: i + 1, kind: slideKindOf(t.trim()).kind }))
        .filter((s) => s.kind === "quiz")
        .map((s) => s.no);
      if (quizSlides.length === 0) return;

      setBusy("ai");
      setNotice(`제목에서 퀴즈 슬라이드 ${quizSlides.length}장을 찾았어요. 대본을 읽는 중이에요…`);
      const made = new Map<number, QuizItem[]>();
      try {
        // 서버를 한꺼번에 때리지 않게 네 장씩 끊어서 부른다
        for (let i = 0; i < quizSlides.length; i += 4) {
          const chunk = quizSlides.slice(i, i + 4);
          const results = await Promise.all(
            chunk.map((no) => askFor(no, file, titles).catch(() => [] as QuizItem[])),
          );
          chunk.forEach((no, n) => results[n].length && made.set(no, results[n]));
        }
        const total = [...made.values()].reduce((n, items) => n + items.length, 0);
        if (total > 0) {
          attach(made);
          setNotice(`퀴즈 슬라이드 ${made.size}장에 ${total}문항을 만들어 뒀어요. 확인하고 고쳐주세요.`);
        } else {
          setNotice("퀴즈 슬라이드를 찾았지만 대본에서 문항을 만들지 못했어요. 슬라이드마다 직접 넣어주세요.");
        }
      } finally {
        setBusy("");
      }
    },
    [askFor, attach],
  );

  /** 지금 보고 있는 슬라이드에서 «대본으로 만들기»를 눌렀을 때 */
  const extractWithAi = useCallback(async () => {
    const source = pptx ?? (isSample ? ("sample" as const) : null);
    if (!source) {
      // PDF로 내보내는 순간 발표자 노트는 떨어져 나간다 — 파일 형식의 한계라 되살릴 수 없다
      setNotice(
        "이 자료에는 강의 대본이 없어요. 대본은 PPT의 «발표자 노트»에 들어 있고 PDF로 저장하면 사라집니다. " +
          "노트가 적힌 PPT 파일을 올려주시면 그 내용으로 문항을 만들어 드려요.",
      );
      return;
    }
    const slideNo = state.currentSlide;

    setBusy("ai");
    setNotice(`${slideNo}쪽 강의 대본을 읽는 중이에요…`);
    try {
      const titles = state.pdfKey ? await extractTitles(state.pdfKey) : [];
      const items = await askFor(slideNo, source, titles);
      if (items.length === 0) {
        setNotice(`${slideNo}쪽 대본에는 물어볼 만한 내용이 없어요. «＋ 퀴즈 문항»으로 직접 넣으셔도 됩니다.`);
        return;
      }
      attach(new Map([[slideNo, items]]));
      // 화면은 그대로 둔다 — 문항이 이 슬라이드 바로 아래에 생긴다
      setNotice(`${slideNo}쪽 대본에서 ${items.length}문항을 만들었어요. 아래에서 확인하고 고쳐주세요.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문항을 뽑지 못했어요.");
    } finally {
      setBusy("");
    }
  }, [askFor, attach, isSample, pptx, state.currentSlide, state.pdfKey]);

  // public/samples 에 넣어둔 강의자료. 바꾸려면 이 경로만 고치면 된다.
  const loadSample = useCallback(async () => {
    setBusy("pdf");
    try {
      await liveClient(sessionId).send({ action: "sample" });
      const live = liveClient(sessionId).snapshot();
      const slides = live.deck?.slides ?? [];
      const labs = slides.filter((s) => s.kind === "lab").length;
      const items = slides.reduce((n, s) => n + s.items.length, 0);
      setNotice(`${live.session.pdfName ?? "샘플"} · ${slides.length}장 · 실습 ${labs}개 · 참여요소 ${items}문항을 준비했어요. 학생 입장 링크로 바로 참여할 수 있어요.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "샘플을 불러오지 못했어요.");
    } finally {
      setBusy("");
    }
  }, [sessionId]);

  /**
   * 지금 보고 있는 슬라이드를 실습으로 만든다.
   * 결과물 게시판은 수업 안에 같이 들어 있어서, 실습으로 표시하면 바로 쓸 수 있다.
   */
  const addBoardHere = useCallback(async () => {
    const slideNo = state.currentSlide;
    // 실습 번호는 이미 있는 것 다음으로. 교안에서 온 번호(실습 6~11)와 이어지게 한다.
    const labNo = slide?.labNo ?? Math.max(0, ...labSlides.map((s) => s.labNo ?? 0)) + 1;
    await liveClient(sessionId).send({ action: "markLab", slideNo, labNo });
    setNotice(`${slideNo}쪽을 실습 ${labNo}로 만들었어요. 학생 화면에 결과물 올리기가 붙습니다.`);
  }, [labSlides, sessionId, slide, state.currentSlide]);

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
      {/* 지금 어느 수업을 진행 중인지가 이 화면에서 제일 큰 글자여야 한다 */}
      <header className="sticky top-14 z-20 border-b border-line-strong bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-6 py-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                강사 화면
              </span>
              <span className="tabular-nums text-xs text-mute">
                {state.totalSlides ? `${state.totalSlides}장` : "슬라이드 없음"}
              </span>
            </p>
            <h1 className="mt-2 truncate text-2xl font-bold leading-tight text-ink">
              {state.pdfName ?? "슬라이드를 올려주세요"}
            </h1>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              className="rounded-full px-3 py-2 text-sm text-mute transition-colors hover:bg-gardenia hover:text-ink"
            >
              사용법
            </button>
            <button
              onClick={loadSample}
              disabled={busy !== ""}
              title="실제 강의 PDF와 교안을 함께 불러옵니다 — 실습 게시판과 퀴즈가 바로 붙어 있는 상태로 열립니다"
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-40"
            >
              샘플
            </button>
            {canUpload ? (
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
                    // 슬라이드를 올린 뒤, 제목이 퀴즈인 장들은 이어서 문항까지 만든다
                    if (f)
                      void onSlideFile(f).then((key) => {
                        if (key && !/\.pdf$/i.test(f.name)) void prefillQuizzes(f, key);
                      });
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <span
                title="올린 슬라이드가 아직 다른 기기로 전달되지 않아 잠시 막아뒀어요. 샘플로 전체 흐름을 그대로 체험하실 수 있습니다."
                className="cursor-not-allowed rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-mute"
              >
                내 자료 올리기 · 준비 중
              </span>
            )}
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

        <SlideComposer
          sessionId={sessionId}
          slideNo={state.currentSlide}
          slide={slide}
          hasSlides={Boolean(state.pdfKey)}
          onAddBoard={addBoardHere}
          // 대본이 없는 자료여도 버튼은 보여준다 — 눌렀을 때 왜 안 되는지 알려주는 편이
          // 버튼이 없어서 «AI 기능이 어디 갔지» 하고 헤매는 것보다 낫다
          onGenerate={extractWithAi}
          generating={busy === "ai"}
        />

        <SlideActivities
          sessionId={sessionId}
          slide={slide}
          posts={posts}
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
              {posts.length > 0 && (
                <p className="ml-auto text-sm text-mute">
                  올라온 결과물 <span className="tabular-nums text-ink-soft">{posts.length}</span>개
                </p>
              )}
            </div>

            {/* 슬라이드 바로가기 — 번호를 알면 치고, 모르면 목록에서 고른다 */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm text-ink-soft">슬라이드 바로가기</span>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const no = Number(jumpTo);
                  if (Number.isInteger(no) && no >= 1 && no <= deck.slides.length) {
                    patch({ currentSlide: no, revealAnswer: false });
                    setJumpTo("");
                  }
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  value={jumpTo}
                  onChange={(e) => setJumpTo(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={`1–${deck.slides.length}`}
                  aria-label="슬라이드 번호로 이동"
                  className="w-24 rounded-lg border border-line bg-cream px-3 py-2 text-sm tabular-nums text-ink outline-none placeholder:text-mute focus:border-mocha"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha"
                >
                  이동
                </button>
              </form>

              <select
                aria-label="슬라이드 목록에서 이동"
                value={state.currentSlide}
                onChange={(e) => patch({ currentSlide: Number(e.target.value), revealAnswer: false })}
                className="min-w-0 max-w-full flex-1 rounded-lg border border-line bg-cream px-3 py-2 text-sm"
              >
                {deck.slides.map((s) => {
                  // 표시는 제목 앞에 둔다 — 제목 길이가 제각각이라 뒤에 붙이면 눈으로 못 훑는다
                  const marks = [
                    s.kind === "lab" ? `실습 ${s.labNo}` : null,
                    s.items.length > 0 ? `퀴즈 ${s.items.length}문항` : null,
                  ].filter(Boolean);
                  return (
                    <option key={s.slideNo} value={s.slideNo}>
                      {s.slideNo}. {marks.length > 0 && `[${marks.join(" · ")}] `}
                      {s.title}
                    </option>
                  );
                })}
              </select>
            </div>
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
                onClick={() => void copyStudentLink()}
                aria-live="polite"
                className="shrink-0 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm text-ink-soft hover:border-mocha hover:text-mocha"
              >
                {copyStatus === "copied" ? "복사됐어요!" : copyStatus === "error" ? "복사 실패 · 재시도" : "복사"}
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
          posts={posts}
          responses={responses}
          role="teacher"
          reveal={state.revealAnswer}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onToggleReveal={() => patch({ revealAnswer: !state.revealAnswer })}
          onClose={stopPresenting}
        />
      )}

      <OnboardingModal
        role="teacher"
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onStartSample={loadSample}
        loading={busy !== ""}
      />
    </div>
  );
}
