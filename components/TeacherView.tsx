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
import { isSharedKey } from "@/lib/sync/pdfStore";
import { upload } from "@vercel/blob/client";
import { useSync } from "@/lib/sync/useSync";
import { deckFromTitles } from "@/lib/lecture/parseDeck";
import { extractTitles } from "@/lib/lecture/pdfTitles";
import { useCurrentSlide, useDeckState, useLabSlides } from "@/lib/lecture/useDeck";
import { QuizItem } from "@/lib/types";
import { liveClient } from "@/lib/live/client";
import LiveStatus from "./lecture/LiveStatus";
import OnboardingModal from "./lecture/OnboardingModal";
import type { GenerationMode } from "@/lib/lecture/aiQuizRules";
import InsertSlide from "./lecture/InsertSlide";

const noSubscribe = () => () => {};
const emptyString = () => "";

export default function TeacherView({ sessionId, localUploads = false, cloudConversion = false }: { sessionId: string; localUploads?: boolean; cloudConversion?: boolean }) {
  const { state, patch } = useSync(sessionId);
  const { deck, responses, posts } = useDeckState(sessionId);
  const slide = useCurrentSlide(sessionId, state.currentSlide);
  const labSlides = useLabSlides(sessionId);

  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  // 샘플 강의는 노트를 서버에 넣어두어서, PPT를 올리지 않아도 AI로 뽑아볼 수 있다
  const isSample = state.pdfKey?.startsWith("/samples/") ?? false;
  const isLocalPpt = localUploads && !!state.pdfKey?.startsWith("/api/local-material/") && /\.pptx$/i.test(state.pdfName ?? "");
  const isCloudPpt = cloudConversion && !localUploads && /\.pptx$/i.test(state.pdfName ?? "");
  const supportsPpt = localUploads || cloudConversion;
  const pendingConversion = useSyncExternalStore(noSubscribe, useCallback(() => localStorage.getItem(`classflow:conversion:${sessionId}`) ?? "", [sessionId]), emptyString);

  /**
   * 올린 슬라이드가 학생 기기까지 갔는지.
   * 공유 저장소에 올라갔으면 주소(https://…)가 키가 되고, 실패해서 이 브라우저에만
   * 남았으면 «세션:uuid» 꼴이 된다. 후자면 학생 화면이 비므로 강사에게 알려줘야 한다.
   */
  const slidesShared = !state.pdfKey || isSharedKey(state.pdfKey);
  const [jumpTo, setJumpTo] = useState("");
  const [presenting, setPresenting] = useState(false);
  const [insertAt, setInsertAt] = useState<{ page: number; side: "before" | "after" } | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  useEffect(() => () => { if (exportUrl) URL.revokeObjectURL(exportUrl); }, [exportUrl]);
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

  /**
   * 올린 슬라이드를 공유 저장소에 두고 그 주소를 슬라이드 키로 쓴다.
   * 저장소가 없는 환경(로컬)에서는 예전처럼 이 브라우저에만 넣는다 — 그때는
   * 학생 화면에 안 보이므로, 아래 canShareSlides로 강사에게 알려준다.
   */
  const storeAndUse = useCallback(
      async (buf: ArrayBuffer, name: string, notes: { slideNo: number; text: string }[] = [], original?: File) => {
      if (!buf.byteLength || buf.byteLength > 60 * 1024 * 1024) throw new Error("60MB 이하 PDF를 선택해 주세요.");
      if (!new TextDecoder().decode(buf.slice(0, 5)).startsWith("%PDF-")) throw new Error("올바른 PDF 파일을 선택해 주세요.");
      await liveClient(sessionId).send({ action: "patch", partial: {} });
      const token = localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "";
      let key: string;
      if (localUploads) {
        const form = new FormData();
        form.append("pdf", new Blob([buf], { type: "application/pdf" }), "lesson.pdf");
          form.append("notes", JSON.stringify(notes));
          if (original) form.append("original", original);
        const response = await fetch(`/api/local-material?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST", headers: { "x-teacher-token": token }, body: form });
        const body = await response.json();
        if (!response.ok || !body.url) throw new Error(body.error ?? "로컬에 저장하지 못했어요.");
        key = body.url;
      } else {
      const blob = await upload(`decks/${sessionId}/${crypto.randomUUID()}.pdf`, new Blob([buf], { type: "application/pdf" }), {
        access: "public", handleUploadUrl: "/api/slides", clientPayload: JSON.stringify({ sessionId }),
        headers: { "x-teacher-token": token }, multipart: true,
        onUploadProgress: ({ percentage }) => setNotice(`PDF 공유 저장소에 올리는 중… ${Math.round(percentage)}%`),
      });
      key = blob.url;
      }
      const titles = await extractTitles(key);
      // 다른 자료의 퀴즈와 가이드가 새 PDF에 잘못 연결되지 않게 새 덱으로 교체한다.
      await liveClient(sessionId).send({ action: "replaceMaterial", pdfKey: key, name, deck: { sessionId, classId: null,
        slides: deckFromTitles(titles.map((title, i) => title || `슬라이드 ${i + 1}`)), source: "pdf", updatedAt: Date.now() } });
      setNotice(localUploads ? `${titles.length}쪽을 이 컴퓨터에 저장했어요. 같은 로컬 서버의 학생 화면에서도 볼 수 있어요. 발표자 노트 ${notes.length}쪽 · AI는 실행하지 않았어요.` : "PDF를 공유했어요. 학생도 같은 슬라이드를 볼 수 있습니다.");
      return key;
    },
    [sessionId, localUploads],
  );

  const applyConvertedPdf = useCallback(async (key: string, name: string) => {
    setNotice("변환한 PDF의 페이지를 읽고 수업을 준비하고 있어요…");
    const titles = await extractTitles(key);
    await liveClient(sessionId).send({ action: "replaceMaterial", pdfKey: key, name, deck: { sessionId, classId: null,
      slides: deckFromTitles(titles.map((title, i) => title || `슬라이드 ${i + 1}`)), source: "pdf", updatedAt: Date.now() } });
    localStorage.removeItem(`classflow:conversion:${sessionId}`);
    setNotice(`${titles.length}쪽 PPT를 불러왔어요. 기존 퀴즈 페이지를 확인합니다.`);
  }, [sessionId]);

  const importExistingQuizzes = useCallback(async (file?: File) => {
    setBusy("import");
    try {
      const {extractNotes}=await import("@/lib/lecture/pptxNotes");
      let notes;
      if(file) notes=extractNotes(await file.arrayBuffer());
      else if(cloudConversion && !localUploads) {
        const {originalSharedPpt}=await import("@/lib/conversion/client");
        notes=extractNotes(await originalSharedPpt(sessionId));
      } else {
        const response=await fetch(`/api/local-material?sessionId=${encodeURIComponent(sessionId)}`,{headers:{"x-teacher-token":localStorage.getItem(`classflow:teacher:${sessionId}`)??""}});
        const body=await response.json();
        if(!response.ok) throw Error(body.error??"발표자 노트를 읽지 못했어요.");
        notes=body.notes;
      }
      const {importPptQuizzes}=await import("@/lib/lecture/importPptQuizzes");
      setNotice(await importPptQuizzes(sessionId,notes,setNotice));
    } catch(error) {setNotice(error instanceof Error?error.message:"PPT 퀴즈를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.");}
    finally {setBusy("");}
  },[sessionId,cloudConversion,localUploads]);

  /** 대용량 PPT는 암호화 후 Blob으로 직접 업로드한다. */
  const onSlideFile = useCallback(async (file: File) => {
    setBusy("pdf");
    setNotice("");
    try {
      if (cloudConversion && !localUploads && /\.pptx$/i.test(file.name)) {
        await liveClient(sessionId).send({ action: "patch", partial: {} });
        const { convertSharedPpt } = await import("@/lib/conversion/client");
        const result = await convertSharedPpt(sessionId, file, setNotice);
        await applyConvertedPdf(result.url, result.name);
        await importExistingQuizzes(file);
      } else if (localUploads && /\.pptx$/i.test(file.name)) {
        if (file.size > 200 * 1024 * 1024) throw new Error("200MB 이하 PPTX를 선택해 주세요.");
        setNotice("PPT의 발표자 노트를 읽고 있어요. AI를 호출하지 않습니다.");
        const { extractNotes } = await import("@/lib/lecture/pptxNotes");
        const notes = extractNotes(await file.arrayBuffer());
        await liveClient(sessionId).send({ action: "patch", partial: {} });
        const token = localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "";
        const form = new FormData(); form.append("file", file);
        setNotice("PPT를 PDF로 변환 중이에요. 자료 크기에 따라 최대 3분 정도 걸릴 수 있어요.");
        const response = await fetch(`/api/convert?sessionId=${encodeURIComponent(sessionId)}`, { method: "POST", headers: { "x-teacher-token": token }, body: form, signal: AbortSignal.timeout(200000) });
        if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "PPT 변환에 실패했어요."); }
        setNotice("변환한 PDF를 저장하고 페이지를 읽는 중이에요…");
        await storeAndUse(await response.arrayBuffer(), file.name, notes, file);
        await importExistingQuizzes(file);
      } else {
        if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error(localUploads ? "PPTX 또는 PDF 파일을 선택해 주세요." : "PDF 파일만 업로드할 수 있습니다.");
        await storeAndUse(await file.arrayBuffer(), file.name);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "PDF를 업로드하지 못했어요.");
    } finally { setBusy(""); }
  }, [storeAndUse, localUploads, cloudConversion, sessionId, applyConvertedPdf, importExistingQuizzes]);

  /**
   * 슬라이드 한 장의 발표자 노트(강의 대본)를 읽어 문항을 만든다.
   * 제목만으로는 «여기 퀴즈가 있다»까지만 알 수 있고, 문항·선택지·정답은 대본에 있다.
   */
  const askFor = useCallback(
    async (slideNo: number, titles: string[], mode: GenerationMode) => {
      const form = new FormData();
      if (isSample) form.append("sample", "true");
      else if (isCloudPpt) {
        const { originalSharedPpt } = await import("@/lib/conversion/client");
        const { extractNotes } = await import("@/lib/lecture/pptxNotes");
        const notes = extractNotes(await originalSharedPpt(sessionId)).filter(n => n.slideNo === slideNo && n.text.trim());
        if (!notes.length) throw new Error("이 슬라이드에는 발표자 노트가 없어요. 노트가 있는 페이지를 선택해 주세요.");
        form.append("notes", JSON.stringify(notes));
      } else {
        const token = localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "";
        const response = await fetch(`/api/local-material?sessionId=${encodeURIComponent(sessionId)}`, { headers: { "x-teacher-token": token } });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "발표자 노트를 읽지 못했어요.");
        const notes = (body.notes as { slideNo: number; text: string }[]).filter(n => n.slideNo === slideNo && n.text.trim());
        if (!notes.length) throw new Error("이 슬라이드에는 발표자 노트가 없어요. 노트가 있는 페이지를 선택해 주세요.");
        form.append("notes", JSON.stringify(notes));
      }
      form.append("mode", mode);
      form.append("slideNos", JSON.stringify([slideNo]));
      form.append("titles", JSON.stringify(titles));
      // Only quiz text/answers are context; never send student responses or submissions.
      const history = [...(deck?.slides ?? [])].sort((a, b) => a.slideNo - b.slideNo)
        .flatMap(s => s.items.map(item => ({
          slideNo: s.slideNo, question: item.question, options: item.options,
          answers: item.answers, ...(item.quizType ? { quizType: item.quizType } : {}),
        })));
      const before = history.filter(item => item.slideNo <= slideNo).slice(-80);
      const after = history.filter(item => item.slideNo > slideNo).slice(0, 20);
      form.append("quizHistory", JSON.stringify([...before, ...after]));

      const res = await fetch("/api/extract-quiz", { method: "POST", body: form });
      const body = (await res.json()) as { items?: QuizItem[]; error?: string };
      if (!res.ok || !body.items) throw new Error(body.error ?? "문항을 뽑지 못했어요.");
      return body.items;
    },
    [deck, isSample, isCloudPpt, sessionId],
  );

  /** 만든 문항을 그 슬라이드에만 얹는다 */
  const attach = useCallback(
    async (made: Map<number, QuizItem[]>) => {
      const current = liveClient(sessionId).snapshot().deck;
      if (!current) throw new Error("수업 자료를 찾지 못했어요.");
      await liveClient(sessionId).send({ action: "deck", deck: { ...current,
        slides: current.slides.map((s) => {
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
        }), updatedAt: Date.now(),
      } });
    },
    [sessionId],
  );

  /** 지금 보고 있는 슬라이드에서 «대본으로 만들기»를 눌렀을 때 */
  const extractWithAi = useCallback(async (mode: GenerationMode = "quiz") => {
    if ((!isSample && !isLocalPpt && !isCloudPpt) || slide?.content) {
      setNotice("해당 기능은 발표자 노트가 포함된 PPT에서만 사용 가능합니다.");
      return "해당 기능은 발표자 노트가 포함된 PPT에서만 사용 가능합니다.";
    }
    const slideNo = state.currentSlide;

    setBusy("ai");
    setNotice(`${slideNo}쪽 강의 대본을 읽는 중이에요…`);
    try {
      const titles = state.pdfKey ? await extractTitles(state.pdfKey) : [];
      const items = await askFor(slide?.pdfPage ?? slideNo, titles, mode);
      if (items.length === 0) {
        setNotice(`${slideNo}쪽 대본에는 물어볼 만한 내용이 없어요. «＋ 퀴즈 문항»으로 직접 넣으셔도 됩니다.`);
        return `${slideNo}쪽 대본에는 물어볼 만한 내용이 없어요. «＋ 퀴즈 문항»으로 직접 넣으셔도 됩니다.`;
      }
      await attach(new Map([[slideNo, items]]));
      // 화면은 그대로 둔다 — 문항이 이 슬라이드 바로 아래에 생긴다
      setNotice(`${slideNo}쪽 대본에서 ${items.length}문항을 만들었어요. 아래에서 확인하고 고쳐주세요.`);
      return `${slideNo}쪽 대본에서 ${items.length}문항을 만들고 저장했어요. 아래에서 확인해 주세요.`;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "문항을 뽑지 못했어요.");
      return error instanceof Error ? error.message : "문항을 뽑지 못했어요.";
    } finally {
      setBusy("");
    }
  }, [askFor, attach, isSample, isLocalPpt, isCloudPpt, state.currentSlide, state.pdfKey, slide]);

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
      if (presenting || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, presenting]);

  const stopPresenting = useCallback(() => setPresenting(false), []);

  const hasAnswers = slide?.items.some(item => item.hasAnswer ?? item.answers.length > 0) ?? false;

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
              title="준비된 강의자료 61장과 퀴즈·실습을 열어 체험합니다"
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-40"
            >
              샘플 수업 체험하기
            </button>
            {(isLocalPpt || isCloudPpt) && <button disabled={!!busy} onClick={async () => {
              setBusy("pptx");
              try {
                let original: Blob;
                if (isCloudPpt) {
                  const { originalSharedPpt } = await import("@/lib/conversion/client");
                  original = new Blob([await originalSharedPpt(sessionId)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
                } else {
                  const token = localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "";
                  const response = await fetch(`/api/local-material?sessionId=${encodeURIComponent(sessionId)}&download=pptx`, { headers: { "x-teacher-token": token } });
                  if (!response.ok) throw new Error((await response.json()).error ?? "PPTX를 내려받지 못했어요.");
                  original = await response.blob();
                }
                const url = URL.createObjectURL(original);
                const link = document.createElement("a"); link.href = url; link.download = state.pdfName ?? "수업자료.pptx"; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                setNotice("업로드한 원본 PPTX 다운로드를 시작했어요. 추가 페이지는 수업 PDF에 포함됩니다.");
              } catch (error) { setNotice(error instanceof Error ? error.message : "PPTX 다운로드 실패"); }
              finally { setBusy(""); }
            }} className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-40">원본 PPTX 다운로드</button>}
            {state.pdfKey && <button disabled={!!busy} onClick={async () => {
              setBusy("export"); setNotice("추가 페이지를 포함한 PDF를 만드는 중이에요…");
              try {
                const { downloadLessonPdf } = await import("@/lib/lecture/exportLessonPdf");
                const exported = await downloadLessonPdf(liveClient(sessionId).snapshot());
                setExportUrl(exported.url);
                setNotice(`${exported.total}쪽 PDF 다운로드를 시작했어요. 추가 이미지와 현재 참여 결과가 포함됩니다.`);
              } catch (err) { setNotice(err instanceof Error ? err.message : "PDF를 만들지 못했어요."); }
              finally { setBusy(""); }
            }} title="추가 이미지와 현재 참여 결과를 포함합니다" className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-40">{busy === "export" ? "PDF 만드는 중…" : "수업 PDF 다운로드"}</button>}
            {exportUrl && <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-mocha underline">최근 만든 PDF 열기</a>}
            <label
                title={supportsPpt ? "PPTX는 기존 퀴즈를 AI로 읽어 참여 문항으로 불러옵니다. 새 문제를 만들지는 않습니다." : "학생과 공유할 PDF 파일을 업로드하세요."}
                className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep"
              >
                {busy === "pdf" ? "자료 준비 중…" : supportsPpt ? "PPTX·PDF 올려 수업 시작" : "PDF 업로드"}
                <input
                  type="file"
                  disabled={busy !== ""}
                  accept={supportsPpt ? ".pptx,.pdf,application/pdf" : ".pdf,application/pdf"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onSlideFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {(isLocalPpt || isCloudPpt) && <button disabled={!!busy} className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-40" onClick={()=>void importExistingQuizzes()} title="이미 문항이 있는 페이지는 유지하고, 빈 퀴즈 페이지만 원본 PPT에서 읽습니다.">{busy==="import"?"PPT 퀴즈 불러오는 중…":"PPT 퀴즈 다시 불러오기"}</button>}
              {cloudConversion && pendingConversion && <button disabled={!!busy} className="rounded-full border border-line-strong px-4 py-2 text-sm disabled:opacity-40" onClick={async () => {
                setBusy("pdf");
                try {
                  const { waitForConversion } = await import("@/lib/conversion/client");
                  const result = await waitForConversion(sessionId, pendingConversion, setNotice);
                  await applyConvertedPdf(result.url, result.name);
                  await importExistingQuizzes();
                } catch (error) { setNotice(error instanceof Error ? error.message : "변환 결과를 확인하지 못했어요."); }
                finally { setBusy(""); }
              }}>변환 결과 확인</button>}

          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <LiveStatus sessionId={sessionId} />
        {!slidesShared && (
          <p className="mb-4 rounded-xl border border-rosetan/40 bg-rosetan/10 px-4 py-3 text-sm text-ink-soft">
            이 슬라이드는 <strong className="text-ink">이 브라우저에만</strong> 저장됐어요. 학생
            화면에는 보이지 않습니다. 슬라이드를 다시 올려보시고, 계속 이러면 저장 공간 설정을
            확인해 주세요.
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
            {notice}
          </p>
        )}

        {/* 슬라이드 */}
        <div className="relative flex items-center gap-2 sm:gap-3">
        {localUploads && state.pdfKey && <InsertSlide key={`before-${state.currentSlide}`} sessionId={sessionId} page={state.currentSlide} side="before" disabled={!!busy}
          open={insertAt?.page === state.currentSlide && insertAt.side === "before"} onToggle={() => setInsertAt(insertAt?.page === state.currentSlide && insertAt.side === "before" ? null : { page: state.currentSlide, side: "before" })} onClose={() => setInsertAt(null)} />}
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-paper p-3">
          <SlideStage
            sessionId={sessionId}
            pdfKey={state.pdfKey}
            page={state.currentSlide}
            canDraw
            keyboardActive={!presenting}
            onLoaded={(total) => {
              const count = deck?.slides.length || total;
              if (count !== state.totalSlides) patch({ totalSlides: count });
            }}
          />
        </div>
        {localUploads && state.pdfKey && <InsertSlide key={`after-${state.currentSlide}`} sessionId={sessionId} page={state.currentSlide} side="after" disabled={!!busy}
          open={insertAt?.page === state.currentSlide && insertAt.side === "after"} onToggle={() => setInsertAt(insertAt?.page === state.currentSlide && insertAt.side === "after" ? null : { page: state.currentSlide, side: "after" })} onClose={() => setInsertAt(null)} />}
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

          {hasAnswers && (
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
          generationBlockedMessage={(!isSample && !isLocalPpt && !isCloudPpt) || slide?.content ? "해당 기능은 발표자 노트가 포함된 PPT에서만 사용 가능합니다." : undefined}
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
              학생에게 위 링크를 보내 주세요. 가입 없이 참여하고, 같은 슬라이드를 보며 퀴즈와 실습을 할 수 있어요.
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

