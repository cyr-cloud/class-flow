"use client";

// 처음 들어온 사람에게 한 번 보여주는 사용법.
// 강사와 학생이 할 일이 전혀 달라서 안내도 따로 둔다 — 학생에게 «슬라이드를 올리세요»는 쓸모가 없다.

import { useCallback, useState, useSyncExternalStore } from "react";

type Role = "teacher" | "student";

// 안내 내용을 고치면 뒤의 숫자를 올린다 — 이미 닫아본 사람에게도 한 번 더 보여준다
const STORAGE_KEY = (role: Role) => `classflow:onboarding:${role}:v1`;
const EVENT = "classflow:onboarding-change";

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

const getServerSeen = () => true;

const GUIDE: Record<
  Role,
  { title: string; lead: string; steps: { no: string; title: string; description: string }[]; tip: string }
> = {
  teacher: {
    title: "교안에서 참여까지,\n수업의 흐름을 한곳에.",
    lead: "쓰시던 슬라이드를 그대로 올리면, 학생이 함께 보고 답하는 수업이 됩니다.",
    steps: [
      {
        no: "01",
        title: "슬라이드 올리기",
        description: "PPT를 올리면 제목에서 실습·퀴즈 슬라이드를 찾아냅니다.",
      },
      {
        no: "02",
        title: "학생에게 코드 주기",
        description: "아래 참여 코드를 불러주면 학생 화면이 내 슬라이드를 따라옵니다.",
      },
      {
        no: "03",
        title: "같이 답하고 확인",
        description: "학생이 답하면 응답이 실시간으로 모이고, 정답은 내가 공개합니다.",
      },
    ],
    tip: "아무 슬라이드에서나 «✦ AI로 퀴즈 만들기»를 누르면, 그 장의 발표자 노트(강의 대본)를 읽어 문항을 만들어 줍니다.",
  },
  student: {
    title: "보기만 하지 말고,\n같이 하면서 들으세요.",
    lead: "화면은 강사님을 따라 자동으로 넘어갑니다. 따로 누르실 것이 없어요.",
    steps: [
      {
        no: "01",
        title: "그냥 따라가기",
        description: "강사님이 슬라이드를 넘기면 내 화면도 같이 넘어갑니다.",
      },
      {
        no: "02",
        title: "퀴즈가 뜨면 누르기",
        description: "슬라이드 아래에 문항이 나오면 번호를 눌러 답하세요. 바꿔도 됩니다.",
      },
      {
        no: "03",
        title: "실습 결과물 올리기",
        description: "실습 슬라이드에서는 안내를 읽고, 다 하면 화면을 캡처해 올립니다.",
      },
    ],
    tip: "이름은 비워두면 익명으로 올라갑니다. 휴대폰으로도 그대로 참여할 수 있어요.",
  },
};

export default function OnboardingModal({
  role,
  open,
  onOpenChange,
  onStartSample,
  loading,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 강사 화면에서만 — 샘플 강의를 바로 연다 */
  onStartSample?: () => Promise<void>;
  loading?: boolean;
}) {
  const seen = useSyncExternalStore(
    subscribe,
    useCallback(() => window.localStorage.getItem(STORAGE_KEY(role)) === "seen", [role]),
    getServerSeen,
  );
  const visible = open || !seen;
  const guide = GUIDE[role];
  // 기본은 «다음에도 보여주기». 닫을 때 체크되어 있으면 그때부터 안 뜬다.
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const remember = useCallback(() => {
    if (!dontShowAgain) return;
    window.localStorage.setItem(STORAGE_KEY(role), "seen");
    window.dispatchEvent(new Event(EVENT));
  }, [dontShowAgain, role]);

  const close = useCallback(() => {
    remember();
    onOpenChange(false);
  }, [onOpenChange, remember]);

  const startSample = useCallback(async () => {
    remember();
    onOpenChange(false);
    await onStartSample?.();
  }, [onOpenChange, onStartSample, remember]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink/55 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/50 bg-paper shadow-2xl"
      >
        <div className="bg-ink px-6 py-7 text-white sm:px-9 sm:py-9">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-white/55">
                {role === "teacher" ? "강사용 안내" : "학생용 안내"}
              </p>
              <h2 id="onboarding-title" className="mt-3 whitespace-pre-line text-2xl font-bold sm:text-3xl">
                {guide.title}
              </h2>
              <p id="onboarding-description" className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                {guide.lead}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="사용법 닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-xl text-white/70 transition-colors hover:border-white/50 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-9 sm:py-8">
          <ol className="grid gap-3 sm:grid-cols-3">
            {guide.steps.map((step) => (
              <li key={step.no} className="rounded-2xl border border-line bg-cream p-4">
                <span className="font-mono text-xs font-semibold text-mocha">{step.no}</span>
                <h3 className="mt-2 font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-ink-soft">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-mocha-tint px-4 py-3.5">
            <span aria-hidden className="mt-0.5 text-lg">
              {role === "teacher" ? "✦" : "↔"}
            </span>
            <p className="text-sm leading-6 text-ink-soft">{guide.tip}</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer select-none items-center gap-2 px-1 text-sm text-mute transition-colors hover:text-ink">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="h-4 w-4 accent-mocha"
              />
              다시 보지 않기
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={close}
              className="rounded-full px-5 py-2.5 text-sm text-mute transition-colors hover:bg-gardenia hover:text-ink"
            >
              {role === "teacher" ? "내 자료로 시작할게요" : "닫기"}
            </button>
            {role === "teacher" && onStartSample ? (
              <button
                type="button"
                onClick={() => void startSample()}
                disabled={loading}
                className="rounded-full bg-mocha px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mocha-deep disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "샘플 준비 중…" : "샘플로 1분 체험하기 →"}
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-mocha px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mocha-deep"
              >
                알겠어요, 시작할게요
              </button>
            )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
