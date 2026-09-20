"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { onboardingSteps, OnboardingRole } from "./onboardingSteps";

const STORAGE_KEY = (role: OnboardingRole) => `classflow:onboarding:${role}:v2`;
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
type Props = {
  role: OnboardingRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartSample?: () => Promise<void>;
  loading?: boolean;
};

export default function OnboardingModal(props: Props) {
  return <RoleGuide key={props.role} {...props} />;
}

function RoleGuide({ role, open, onOpenChange, onStartSample, loading }: Props) {
  const seen = useSyncExternalStore(subscribe, useCallback(() => {
    try { return window.localStorage.getItem(STORAGE_KEY(role)) === "seen"; }
    catch { return false; }
  }, [role]), getServerSeen);
  const [dismissed, setDismissed] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const id = useId();
  const visible = open || (!seen && !dismissed);
  const steps = onboardingSteps[role];
  const step = steps[index];
  const last = index === steps.length - 1;

  const close = useCallback(() => {
    if (dontShowAgain) {
      try { window.localStorage.setItem(STORAGE_KEY(role), "seen"); }
      catch { /* Closing still works when storage is unavailable. */ }
      window.dispatchEvent(new Event(EVENT));
    }
    setDismissed(true);
    setIndex(0);
    onOpenChange(false);
  }, [dontShowAgain, onOpenChange, role]);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [visible]);

  if (!visible) return null;
  const [width, height] = step.size ?? [1265, 712];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
        className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl outline-none"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); close(); }
          if (event.key === "ArrowRight") { event.preventDefault(); setIndex((n) => Math.min(n + 1, steps.length - 1)); }
          if (event.key === "ArrowLeft") { event.preventDefault(); setIndex((n) => Math.max(n - 1, 0)); }
          if (event.key === "Tab") {
            const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]');
            if (!elements?.length) return;
            const first = elements[0], end = elements[elements.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); end.focus(); }
            else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
          }
        }}>
        <header className="shrink-0 border-b border-line px-5 pb-4 pt-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-mocha">CLASSFLOW · {role === "teacher" ? "강사용" : "학생용"} 사용법</p>
              <h2 id={`${id}-title`} className="mt-1 text-xl font-bold text-ink sm:text-2xl">{role === "teacher" ? "수업 준비부터 참여 확인까지" : "입장부터 실습 결과 공유까지"}</h2>
            </div>
            <button type="button" aria-label="사용법 닫기" onClick={close} className="h-10 w-10 shrink-0 rounded-full border border-line text-2xl text-ink-soft hover:bg-gardenia">×</button>
          </div>
          <nav aria-label="사용법 단계" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {steps.map((item, n) => <button key={item.label} type="button" aria-current={index === n ? "step" : undefined}
              onClick={() => setIndex(n)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${index === n ? "bg-ink text-white" : "bg-cream text-mute hover:bg-gardenia"}`}>
              {n + 1}. {item.label}
            </button>)}
          </nav>
        </header>
        <div className="min-h-0 overflow-y-auto" key={index}>
          <div className="grid items-start gap-5 p-5 sm:p-7 lg:grid-cols-[1.7fr_1fr]">
            <figure className="min-w-0">
              <div className="overflow-x-auto rounded-xl border border-line bg-cream">
                <div className="relative min-w-[560px]">
                  <Image src={`/onboarding/${step.image}`} alt={step.alt} width={width} height={height} sizes="(max-width: 1024px) 90vw, 700px" className="block h-auto w-full" />
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                    <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" /></marker></defs>
                    {step.callouts.map((mark, n) => <path key={n} d={`M ${mark.from[0] * 10} ${mark.from[1] * 10} L ${mark.to[0] * 10} ${mark.to[1] * 10}`} fill="none" stroke="#dc2626" strokeWidth="3" vectorEffect="non-scaling-stroke" markerEnd={`url(#${id}-arrow)`} />)}
                  </svg>
                  {step.callouts.map((mark, n) => <span key={n} aria-hidden="true" style={{ left: `${mark.from[0]}%`, top: `${mark.from[1]}%` }} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-red-600 bg-white px-2.5 py-1 text-xs font-bold text-red-700 shadow-sm">{n + 1} {mark.label}</span>)}
                </div>
              </div>
              <figcaption className="mt-2 text-xs leading-5 text-mute">실제 서비스 화면 · 빨간 화살표가 가리키는 곳을 확인하세요.<span className="block sm:hidden">이미지를 옆으로 밀면 나머지 화면을 볼 수 있어요.</span></figcaption>
            </figure>
            <div aria-live="polite" aria-atomic="true">
              <p className="text-xs font-semibold tabular-nums text-mocha">STEP {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</p>
              <h3 className="mt-2 text-xl font-bold leading-snug text-ink">{step.title}</h3>
              <p id={`${id}-description`} className="mt-3 text-sm leading-6 text-ink-soft">{step.description}</p>
              <ol className="mt-5 space-y-4">
                {step.callouts.map((mark, n) => <li key={mark.label} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">{n + 1}</span>
                  <div><h4 className="text-sm font-bold text-ink">{mark.label}</h4><p className="mt-1 text-sm leading-6 text-ink-soft">{mark.detail}</p></div>
                </li>)}
              </ol>
              <p className="mt-5 rounded-xl bg-mocha-tint p-3 text-xs leading-5 text-ink-soft">{step.tip}</p>
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-4 sm:px-7">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-mute sm:text-sm"><input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} className="h-4 w-4 accent-mocha" />다시 보지 않기</label>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full px-3 py-2 text-sm text-mute hover:bg-cream">{last ? "닫기" : "건너뛰기"}</button>
            <button type="button" disabled={index === 0} onClick={() => setIndex((n) => n - 1)} className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft disabled:opacity-30">이전</button>
            {!last ? <button type="button" onClick={() => setIndex((n) => n + 1)} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">다음 →</button>
              : <button type="button" onClick={close} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">시작하기</button>}
            {last && role === "teacher" && onStartSample && <button type="button" disabled={loading} onClick={() => { close(); void onStartSample(); }} className="rounded-full bg-mocha px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? "준비 중…" : "샘플 열기"}</button>}
          </div>
        </footer>
      </section>
    </div>
  );
}
