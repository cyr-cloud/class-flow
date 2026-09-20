"use client";

// 교안 없이 이 슬라이드에 퀴즈 문항과 실습 게시판을 직접 붙이는 강사 전용 도구.
//
// PDF(또는 PPT)만 올린 강사는 교안 마크다운 규격을 몰라도 여기서 바로 문항을 넣을 수 있다.
// 넣은 문항은 그 슬라이드 번호에 붙고, 학생 화면에는 강사가 그 슬라이드에 도달하면 뜬다.

import { useCallback, useState } from "react";
import { liveClient } from "@/lib/live/client";
import { DeckSlide } from "@/lib/types";

const CIRCLES = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
const MAX_OPTIONS = 6;

export default function SlideComposer({
  sessionId,
  slideNo,
  slide,
  hasSlides,
  onAddBoard,
  onGenerate,
  generating,
}: {
  sessionId: string;
  slideNo: number;
  slide: DeckSlide | null;
  /** 슬라이드(PDF)가 올라와 있는지 — 없으면 넣을 자리가 없다 */
  hasSlides: boolean;
  /** 이 슬라이드를 실습으로 만들고 게시판까지 연결한다 */
  onAddBoard: () => Promise<void>;
  /** 이 슬라이드의 발표자 노트로 문항 만들기. 대본을 읽을 수 없으면 없다 */
  onGenerate?: () => Promise<void>;
  generating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isLab = slide?.kind === "lab";

  const reset = useCallback(() => {
    setQuestion("");
    setOptions(["", ""]);
    setAnswers([]);
    setError("");
    setOpen(false);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      // 서버는 빈 선택지를 버린다. 그러면 뒤 번호가 당겨지므로 정답 번호도 같이 옮겨준다
      // (빈 칸에 걸린 정답 표시는 버린다 — 안 그러면 엉뚱한 선택지가 정답이 된다).
      const kept = options.map((o, i) => ({ text: o.trim(), from: i })).filter((o) => o.text);
      const picked = new Set(answers);

      await liveClient(sessionId).send({
        action: "addItem",
        slideNo,
        question,
        options: kept.map((o) => o.text),
        answers: kept.flatMap((o, to) => (picked.has(o.from) ? [to] : [])),
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "문항을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [sessionId, slideNo, question, options, answers, reset]);

  const addBoard = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await onAddBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "실습 게시판을 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [onAddBoard]);

  const unmarkLab = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await liveClient(sessionId).send({ action: "markLab", slideNo, labNo: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "실습 표시를 떼지 못했어요.");
    } finally {
      setBusy(false);
    }
  }, [sessionId, slideNo]);

  if (!hasSlides) return null;

  const ghost =
    "rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft transition-colors hover:border-mocha hover:text-mocha disabled:opacity-40";

  return (
    <div className="mt-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-mute">이 슬라이드에 넣기</span>
          <button type="button" onClick={() => setOpen(true)} className={ghost}>
            ＋ 퀴즈 문항
          </button>
          {onGenerate && (
            <button
              type="button"
              onClick={() => void onGenerate()}
              disabled={busy || generating}
              title="이 슬라이드의 발표자 노트(강의 대본)를 읽어 문항을 만듭니다"
              className="rounded-full border border-mocha px-4 py-2 text-sm font-medium text-mocha-deep transition-colors hover:bg-mocha hover:text-white disabled:opacity-40"
            >
              {generating ? "대본 읽는 중…" : "✦ AI로 퀴즈 만들기"}
            </button>
          )}
          {isLab ? (
            <>
              <span className="rounded-full bg-mocha-tint px-3 py-2 text-sm text-mocha-deep">
                실습 {slide?.labNo}
                {slide?.guide ? " · 가이드 있음" : ""}
              </span>
              <button type="button" onClick={() => void unmarkLab()} disabled={busy} className={ghost}>
                실습 해제
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void addBoard()} disabled={busy} className={ghost}>
              ＋ 실습 게시판
            </button>
          )}
          {error && <span className="text-sm text-rosetan">{error}</span>}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-paper p-5">
          <p className="eyebrow text-mute">{slideNo}쪽에 넣을 문항</p>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="질문을 적어주세요 — 예: 작업 폴더를 고를 때 하면 안 되는 것은?"
            autoFocus
            className="mt-3 w-full rounded-xl border border-line bg-cream px-4 py-3 text-ink outline-none placeholder:text-mute focus:border-mocha"
          />

          <ul className="mt-3 space-y-2">
            {options.map((option, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-sm text-mute">{CIRCLES[i]}</span>
                <input
                  value={option}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`선택지 ${i + 1}`}
                  className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
                />
                <label
                  title="정답으로 표시"
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors ${
                    answers.includes(i)
                      ? "border-tendril bg-tendril text-white"
                      : "border-line-strong text-mute hover:border-tendril hover:text-tendril"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={answers.includes(i)}
                    onChange={(e) =>
                      setAnswers((prev) =>
                        e.target.checked ? [...prev, i] : prev.filter((a) => a !== i),
                      )
                    }
                  />
                  정답
                </label>
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`선택지 ${i + 1} 지우기`}
                    onClick={() => {
                      setOptions((prev) => prev.filter((_, j) => j !== i));
                      setAnswers((prev) =>
                        prev.filter((a) => a !== i).map((a) => (a > i ? a - 1 : a)),
                      );
                    }}
                    className="shrink-0 rounded-full px-2 py-2 text-mute transition-colors hover:text-rosetan"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>

          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="mt-2 text-sm text-mocha hover:underline"
            >
              ＋ 선택지 추가
            </button>
          )}

          <p className="mt-3 text-xs text-mute">
            정답을 하나도 고르지 않으면 정답이 없는 설문 문항이 됩니다. 여러 개를 고르면 복수 선택
            문항이 돼요.
          </p>

          {error && <p className="mt-2 text-sm text-rosetan">{error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-full bg-mocha px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-40"
            >
              {busy ? "넣는 중…" : "문항 넣기"}
            </button>
            <button type="button" onClick={reset} disabled={busy} className={ghost}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
