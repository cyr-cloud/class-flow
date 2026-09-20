"use client";

// 참여요소 한 문항.
// 학생은 선택지를 눌러 응답하고, 강사는 같은 화면에서 응답 현황을 본다.
// 번호별 응답 수는 양쪽 모두에게 실시간으로 보인다 — 같이 맞춰보는 게 목적이라 숨기지 않는다.
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
}: {
  sessionId: string;
  item: QuizItem;
  responses: QuizResponse[];
  role: "teacher" | "student";
  reveal: boolean;
}) {
  const responderId = useResponderId();
  const { counts, total, mine, mineChoices } = tallyOf(item, responses, responderId);
  const isStudent = role === "student";
  const hasAnswer = item.hasAnswer ?? item.answers.length > 0;
  const multiple = item.multiple ?? item.answers.length > 1;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showStudentHint, setShowStudentHint] = useState(false);
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

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink">{item.question}</p>
        <span className="shrink-0 rounded-full bg-gardenia px-2.5 py-1 text-xs tabular-nums text-ink-soft">
          {total}명 응답
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {item.options.map((option, i) => {
          const count = counts[i] ?? 0;
          const ratio = total > 0 ? count / total : 0;
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
                disabled={isStudent && (pending || reveal)}
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
                  <span className="w-9 text-right text-sm tabular-nums text-ink-soft">
                    {count}
                  </span>
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
      {isStudent && <p role="status" className="mt-3 text-xs text-mocha">{error || (pending ? "응답 전송 중…" : reveal ? "정답이 공개되어 응답이 마감됐어요." : mine !== null ? "응답이 저장됐어요. 공개 전까지 바꿀 수 있어요." : "선택지를 눌러 참여해 주세요.")}</p>}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-mute">
          {hasAnswer
            ? isStudent
              ? multiple ? "복수 선택 문항이에요. 해당하는 답을 모두 눌러 주세요." : "번호를 눌러 답해 주세요. 다시 누르면 바꿀 수 있어요."
              : "학생이 누르면 실시간으로 채워집니다."
            : "정답이 없는 설문 문항이에요."}
        </p>
        {role === "teacher" && (
          <span className="flex shrink-0 items-center gap-3">
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
