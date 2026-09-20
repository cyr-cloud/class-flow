"use client";

import { useCallback, useSyncExternalStore } from "react";

// 안내 내용을 고치면 버전을 올린다 — 이미 닫아본 사람에게도 바뀐 내용을 한 번 더 보여준다
const STORAGE_KEY = "classflow:onboarding:v2";
const EVENT = "classflow:onboarding-change";

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function getSeen() {
  return window.localStorage.getItem(STORAGE_KEY) === "seen";
}

const getServerSeen = () => true;

function rememberSeen() {
  window.localStorage.setItem(STORAGE_KEY, "seen");
  window.dispatchEvent(new Event(EVENT));
}

const STEPS = [
  {
    no: "01",
    title: "수업 자료 준비",
    description: "PPT를 올리면 제목에서 실습·퀴즈 슬라이드를 찾아냅니다.",
  },
  {
    no: "02",
    title: "학생에게 링크 공유",
    description: "학생은 가입 없이 링크로 입장하고 강사의 슬라이드를 따라갑니다.",
  },
  {
    no: "03",
    title: "함께 답하고 확인",
    description: "학생이 답하면 응답 현황이 모이고, 강사가 정답을 공개합니다.",
  },
];

export default function OnboardingModal({
  open,
  onOpenChange,
  onStartSample,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartSample: () => Promise<void>;
  loading: boolean;
}) {
  const seen = useSyncExternalStore(subscribe, getSeen, getServerSeen);
  const visible = open || !seen;

  const close = useCallback(() => {
    rememberSeen();
    onOpenChange(false);
  }, [onOpenChange]);

  const startSample = useCallback(async () => {
    rememberSeen();
    onOpenChange(false);
    await onStartSample();
  }, [onOpenChange, onStartSample]);

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
              <p className="text-xs font-semibold tracking-[0.18em] text-white/55">WELCOME TO CLASSFLOW</p>
              <h2 id="onboarding-title" className="mt-3 text-2xl font-bold sm:text-3xl">
                교안에서 참여까지,
                <br />수업의 흐름을 한곳에.
              </h2>
              <p id="onboarding-description" className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                기존 슬라이드와 교안을 연결하면 학생이 함께 보고 답하는 참여형 수업을 바로 시작할 수 있어요.
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
            {STEPS.map((step) => (
              <li key={step.no} className="rounded-2xl border border-line bg-cream p-4">
                <span className="font-mono text-xs font-semibold text-mocha">{step.no}</span>
                <h3 className="mt-2 font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-ink-soft">{step.description}</p>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-mocha-tint px-4 py-3.5">
            <span aria-hidden className="mt-0.5 text-lg">↔</span>
            <p className="text-sm leading-6 text-ink-soft">
              상단의 <strong className="text-ink">강사 / 학생</strong> 토글로 혼자서도 전체 흐름을 체험할 수 있어요.
              샘플에는 실습 6개와 퀴즈 9문항이 들어 있고,
              <strong className="text-ink"> 퀴즈·참여 문항 바로가기</strong>로 문항이 있는 쪽으로 바로 이동합니다.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={close}
              className="rounded-full px-5 py-2.5 text-sm text-mute transition-colors hover:bg-gardenia hover:text-ink"
            >
              내 자료로 시작할게요
            </button>
            <button
              type="button"
              onClick={() => void startSample()}
              disabled={loading}
              className="rounded-full bg-mocha px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mocha-deep disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "샘플 준비 중…" : "샘플로 1분 체험하기 →"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
