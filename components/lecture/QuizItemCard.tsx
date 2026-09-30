"use client";

// 참여요소 한 문항.
// 학생은 선택지를 눌러 응답하고, 강사는 같은 화면에서 응답 현황을 본다.
// 정답이 있는 문항은 학생 화면·발표 화면에서 번호별 응답 수를 정답 공개 전까지 가린다 —
// 다른 사람이 많이 고른 번호를 따라 누르지 않게. 총 응답 수와 내 선택은 계속 보인다.
// 강사 화면은 항상 보이고, 정답 없는 참여 질문은 모두에게 실시간으로 보인다.
// 정답은 강사가 "정답 공개"를 눌러야 표시된다.

import { QuizItem, QuizResponse } from "@/lib/types";
import { useState } from "react";
import { liveClient } from "@/lib/live/client";
import { deckStore, tallyOf, useResponderId } from "@/lib/lecture/useDeck";

const CIRCLES = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

export default function QuizItemCard({
  sessionId,
  item,
  responses,
  role,
  reveal,
  hideTallyBeforeReveal = false,
}: {
  sessionId: string;
  item: QuizItem;
  responses: QuizResponse[];
  role: "teacher" | "student";
  reveal: boolean;
  hideTallyBeforeReveal?: boolean;
}) {
  const responderId = useResponderId();
  const { counts, total, mine, mineChoices } = tallyOf(item, responses, responderId);
  const isStudent = role === "student";
  const hasAnswer = item.hasAnswer ?? item.answers.length > 0;
  const closed = reveal && hasAnswer;
  const tallyHidden = hideTallyBeforeReveal && hasAnswer && !reveal;
  const multiple = item.multiple ?? item.answers.length > 1;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showStudentHint, setShowStudentHint] = useState(false);
  const [editing, setEditing] = useState(false);
  async function respond(index: number) {
    setPending(true);
    setError("");
    try {
      if (multiple) {
        const choices = mineChoices.includes(index) ? mineChoices.filter(i => i !== index) : [...mineChoices, index];
        await liveClient(sessionId).send({ action: "respond", itemId: item.id, responderId, choiceIndex: index, choiceIndices: choices });
      } else await deckStore.respond(sessionId, item.id, index);
    }
    catch { setError("응답을 보내지 못했어요. 연결을 확인하고 다시 눌러 주세요."); }
    finally { setPending(false); }
  }

  if (editing) return <QuizItemEditor sessionId={sessionId} item={item} hasResponses={total > 0} onDone={() => setEditing(false)} />;

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-line font-medium text-ink">{item.question}</p>
        <span className="shrink-0 rounded-full bg-gardenia px-2.5 py-1 text-xs tabular-nums text-ink-soft">
          {total}명 응답
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {item.options.map((option, i) => {
          const count = counts[i] ?? 0;
          const ratio = total > 0 && !tallyHidden ? count / total : 0;
          const picked = mineChoices.includes(i);
          const correct = reveal && hasAnswer && item.answers.includes(i);
          const wrongPick = reveal && hasAnswer && picked && !item.answers.includes(i);

          const tone = correct
            ? "border-tendril"
            : wrongPick
              ? "border-rosetan"
              : picked
                ? "border-mocha"
                : "border-line";
          const fill = correct
            ? "bg-tendril-tint"
            : picked
              ? "bg-mocha-tint"
              : "bg-gardenia/70";

          return (
            <li key={i}>
              <button
                type="button"
                disabled={isStudent && (pending || closed)}
                aria-pressed={picked}
                onClick={() => {
                  if (!isStudent) {
                    setShowStudentHint(true);
                    return;
                  }
                  void respond(i);
                }}
                className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors ${tone} ${
                  isStudent ? "hover:border-mocha" : "cursor-default"
                }`}
              >
                {/* 응답 비율 막대 — 글자 뒤에 깔린다 */}
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${fill}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
                <span className="relative flex items-center gap-3">
                  <span className={`text-sm ${picked || correct ? "text-mocha" : "text-mute"}`}>
                    {CIRCLES[i] ?? i + 1}
                  </span>
                  <span className="flex-1 text-sm text-ink">{option}</span>
                  {correct && (
                    <span className="rounded-full bg-tendril px-2 py-0.5 text-[10px] font-medium text-white">
                      정답
                    </span>
                  )}
                  {picked && (
                    <span className="rounded-full bg-mocha px-2 py-0.5 text-[10px] font-medium text-white">
                      내 선택
                    </span>
                  )}
                  {!tallyHidden && (
                    <span className="w-9 text-right text-sm tabular-nums text-ink-soft">
                      {count}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!isStudent && showStudentHint && (
        <p role="status" className="mt-3 rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">
          퀴즈 답변은 학생 화면에서만 선택할 수 있어요. 학생 화면으로 전환해 참여해 주세요.
        </p>
      )}
      {isStudent && <p role="status" className="mt-3 text-xs text-mocha">{error || (pending ? "응답 전송 중…" : closed ? "정답이 공개되어 응답이 마감됐어요." : mine !== null ? hasAnswer ? "응답이 저장됐어요. 공개 전까지 바꿀 수 있어요." : "응답이 저장됐어요. 다른 선택지를 눌러 바꿀 수 있어요." : "선택지를 눌러 참여해 주세요.")}</p>}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-mute">
          {hasAnswer
            ? isStudent
              ? multiple ? "복수 선택 문항이에요. 해당하는 답을 모두 눌러 주세요." : "번호를 눌러 답해 주세요. 다시 누르면 바꿀 수 있어요."
              : tallyHidden ? "번호별 응답 수는 정답을 공개하면 함께 보여요." : "학생이 누르면 실시간으로 채워집니다."
            : "정답이 없는 참여 질문이에요. 내 경험에 맞게 골라 주세요."}
        </p>
        {role === "teacher" && (
          <span className="flex shrink-0 items-center gap-3">
            <button onClick={() => setEditing(true)} className="text-xs text-mute hover:text-mocha hover:underline">
              문항 수정
            </button>
            {total > 0 && (
              <button
                onClick={() => deckStore.resetItem(sessionId, item.id)}
                className="text-xs text-mute hover:text-ink hover:underline"
              >
                응답 지우기
              </button>
            )}
            {/* 발표 중에 브라우저 기본 확인창이 뜨면 흐름이 끊긴다 — 두 번 눌러 지운다 */}
            <button
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                void liveClient(sessionId)
                  .send({ action: "removeItem", slideNo: item.slideNo, itemId: item.id })
                  .catch(() => setError("문항을 지우지 못했어요."));
              }}
              onBlur={() => setConfirming(false)}
              className={`text-xs hover:underline ${
                confirming ? "font-medium text-rosetan" : "text-mute hover:text-rosetan"
              }`}
            >
              {confirming ? "정말 지울까요? 한 번 더" : "문항 지우기"}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/** 강사가 문항을 고친다 — AI가 만든 문항을 검수할 때 주로 쓴다 */
function QuizItemEditor({ sessionId, item, hasResponses, onDone }: { sessionId: string; item: QuizItem; hasResponses: boolean; onDone: () => void }) {
  const [question, setQuestion] = useState(item.question);
  const [options, setOptions] = useState<string[]>(item.options);
  const [answers, setAnswers] = useState<number[]>(item.answers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const optionsChanged = options.length !== item.options.length || options.some((o, i) => o.trim() !== item.options[i]);

  const setOption = (i: number, value: string) => setOptions(options.map((o, j) => (j === i ? value : o)));
  const removeOption = (i: number) => {
    setOptions(options.filter((_, j) => j !== i));
    // 뒤 선택지가 한 칸씩 당겨지므로 정답 번호도 맞춰 옮긴다
    setAnswers(answers.filter(a => a !== i).map(a => (a > i ? a - 1 : a)));
  };
  const toggleAnswer = (i: number) => setAnswers(answers.includes(i) ? answers.filter(a => a !== i) : [...answers, i].sort((a, b) => a - b));

  const save = async () => {
    setBusy(true); setError("");
    try {
      await liveClient(sessionId).send({ action: "editItem", slideNo: item.slideNo, itemId: item.id, question, options: options.map(o => o.trim()), answers });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요."); }
    finally { setBusy(false); }
  };

  const field = "w-full rounded-lg border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-mocha";
  return (
    <div className="rounded-2xl border border-mocha/40 bg-paper p-5">
      <p className="eyebrow text-mute">문항 수정</p>
      <label className="mt-3 block text-xs font-medium text-ink-soft">질문
        <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} maxLength={2000} className={`mt-1 resize-y ${field}`} />
      </label>
      <p className="mt-4 text-xs font-medium text-ink-soft">선택지 <span className="font-normal text-mute">— 정답인 번호를 눌러 표시하세요. 아무것도 고르지 않으면 정답 없는 참여 질문이 됩니다</span></p>
      <ul className="mt-2 space-y-2">
        {options.map((option, i) => (
          <li key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => toggleAnswer(i)} aria-pressed={answers.includes(i)} title={answers.includes(i) ? "정답 표시 빼기" : "정답으로 표시"}
              className={`h-9 w-9 shrink-0 rounded-full border text-sm ${answers.includes(i) ? "border-tendril bg-tendril text-white" : "border-line-strong text-mute hover:border-tendril"}`}>
              {CIRCLES[i] ?? i + 1}
            </button>
            <input value={option} onChange={e => setOption(i, e.target.value)} maxLength={1000} className={field} />
            {options.length > 2 && (
              <button type="button" onClick={() => removeOption(i)} aria-label={`${i + 1}번 선택지 빼기`} className="shrink-0 px-1 text-sm text-mute hover:text-rosetan">✕</button>
            )}
          </li>
        ))}
      </ul>
      {options.length < 9 && (
        <button type="button" onClick={() => setOptions([...options, ""])} className="mt-2 text-xs text-mocha hover:underline">+ 선택지 추가</button>
      )}
      {optionsChanged && hasResponses && (
        <p className="mt-3 rounded-lg bg-rosetan-tint px-3 py-2 text-xs text-rosetan-deep">선택지를 바꾸면 이 문항에 들어온 응답은 지워져요. 질문이나 정답만 고치면 응답은 그대로 남습니다.</p>
      )}
      {error && <p className="mt-3 text-sm text-rosetan-deep">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button onClick={save} disabled={busy} className="rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-mocha-deep disabled:opacity-40">{busy ? "저장하는 중…" : "저장"}</button>
        <button onClick={onDone} disabled={busy} className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-soft hover:border-mocha disabled:opacity-40">취소</button>
      </div>
    </div>
  );
}
