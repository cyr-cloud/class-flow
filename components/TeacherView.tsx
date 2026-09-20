"use client";

// 강사용 진행 화면.
// 슬라이드를 넘기면 patch()로 상태가 전파되어 학생 화면이 따라온다.
// PDF와 함께 교안 마크다운을 올리면 실습·퀴즈 슬라이드를 알아보고, 그 자리에서
// 참여요소를 열고 응답 현황을 본다. 실습 슬라이드는 실습 게시판과 연결된다.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import SlideStage from "./lecture/SlideStage";
import SlideActivities from "./lecture/SlideActivities";
import SlideComposer from "./lecture/SlideComposer";
import PresentView from "./lecture/PresentView";
import { savePdf } from "@/lib/sync/pdfStore";
import { useSync } from "@/lib/sync/useSync";
import { deckFromTitles } from "@/lib/lecture/parseDeck";
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
  const [presenting, setPresenting] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

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
        // 원본을 들고 있어야 나중에 발표자 노트에서 문항을 뽑을 수 있다
        setPptx(file);
        setNotice("슬라이드를 불러왔어요. 제목에 «실습 N»·«퀴즈»가 있으면 자동으로 표시됩니다.");
      } finally {
        setBusy("");
      }
    },
    [storeAndUse],
  );

  /**
   * 발표자 노트(강의 대본)를 읽어 퀴즈 문항을 뽑는다.
   * 제목만으로는 «여기 퀴즈가 있다»까지만 알 수 있고, 문항·선택지·정답은 대본에 있다.
   */
  const extractWithAi = useCallback(async (only?: number[]) => {
    if (!pptx && !isSample) return;

    // 제목으로 찾아둔 퀴즈·실습 슬라이드만 읽는다. 덱 전체를 보내면 느리고 비싸다.
    const targets = only ?? (deck?.slides ?? []).filter((s) => s.kind !== "normal").map((s) => s.slideNo);
    if (targets.length === 0) {
      setNotice("제목에서 «퀴즈»·«실습 N»을 찾지 못했어요. 슬라이드 아래 «＋ 퀴즈 문항»으로 직접 넣어주세요.");
      return;
    }

    setBusy("ai");
    setNotice(`${targets.length}장의 강의 대본을 읽는 중이에요…`);
    try {
      const form = new FormData();
      if (pptx) form.append("file", pptx);
      else form.append("sample", "true");
      form.append("slideNos", JSON.stringify(targets));
      if (state.pdfKey) form.append("titles", JSON.stringify(await extractTitles(state.pdfKey)));

      const res = await fetch("/api/extract-quiz", { method: "POST", body: form });
      const body = (await res.json()) as {
        slides?: { slideNo: number; kind: "quiz" | "lab"; labNo: number | null; items: QuizItem[] }[];
        readSlides?: number;
        error?: string;
      };
      if (!res.ok || !body.slides) {
        setNotice(body.error ?? "문항을 뽑지 못했어요.");
        return;
      }

      const found = new Map(body.slides.map((s) => [s.slideNo, s]));
      const base = deck?.slides ?? [];
      saveDeck(
        base.map((slide) => {
          const hit = found.get(slide.slideNo);
          if (!hit) return slide;
          // 강사가 손으로 넣은 문항(m…)만 남기고, 앞서 만들어진 것은 새 결과로 갈아끼운다.
          // 버튼을 두 번 눌렀을 때 같은 문항이 두 벌 쌓이지 않게 하려는 것.
          const kept = slide.items.filter((item) => item.id.startsWith("m"));
          return {
            ...slide,
            kind: hit.kind,
            labNo: hit.kind === "lab" ? (hit.labNo ?? slide.labNo) : null,
            items: [
              ...kept,
              ...hit.items.map((item, i) => ({
                ...item,
                id: `ai${slide.slideNo}_${i + 1}`,
                slideNo: slide.slideNo,
                no: kept.length + i + 1,
              })),
            ],
          };
        }),
        "md",
      );

      const labs = body.slides.filter((s) => s.kind === "lab").length;
      const items = body.slides.reduce((n, s) => n + s.items.length, 0);
      setNotice(
        items || labs
          ? `대본 ${body.readSlides ?? 0}장을 읽고 퀴즈 ${items}문항 · 실습 ${labs}개를 만들었어요. 슬라이드마다 확인하고 고쳐주세요.`
          : "대본에서 퀴즈로 만들 만한 내용을 찾지 못했어요.",
      );
      // 만든 문항을 바로 볼 수 있게 첫 퀴즈 슬라이드로 옮겨둔다
      const first = body.slides.find((s) => s.items.length > 0);
      if (first) patch({ currentSlide: first.slideNo, revealAnswer: false });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문항을 뽑지 못했어요.");
    } finally {
      setBusy("");
    }
  }, [deck, isSample, patch, pptx, saveDeck, state.pdfKey]);

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
            {(pptx || isSample) && (
              <button
                onClick={() => void extractWithAi()}
                disabled={busy !== ""}
                title="PPT 발표자 노트의 강의 대본을 읽어 퀴즈 문항·선택지·정답을 만듭니다"
                className="rounded-full border border-mocha px-4 py-2 text-sm font-medium text-mocha-deep transition-colors hover:bg-mocha hover:text-white disabled:opacity-40"
              >
                {busy === "ai" ? "대본 읽는 중…" : "✦ 대본으로 퀴즈 만들기"}
              </button>
            )}
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
                    if (f) void onSlideFile(f);
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
                      {s.guide && <span className="shrink-0 text-xs text-mute">가이드</span>}
                      {(() => {
                        const n = posts.filter((p) => p.slideNo === s.slideNo).length;
                        return (
                          <span className={`shrink-0 text-xs ${n > 1 ? "text-tendril" : "text-mute"}`}>
                            결과물 {n}
                          </span>
                        );
                      })()}
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
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onStartSample={loadSample}
        loading={busy !== ""}
      />
    </div>
  );
}
