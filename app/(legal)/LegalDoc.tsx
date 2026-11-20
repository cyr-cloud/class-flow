import Link from 'next/link';

// 이용약관·개인정보처리방침 공통 틀. 지금은 초안이라 맨 위에 눈에 띄게 알린다(LEGAL-02·03에서 확정).
export default function LegalDoc({ title, version, draft, children }: { title: string; version: string; draft: boolean; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <p className="eyebrow">ClassFlow</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-xs text-mute">판: {version}</p>
      {draft && (
        <p role="note" className="mt-4 rounded-xl border border-mocha bg-mocha-tint px-4 py-3 text-sm leading-relaxed text-mocha-deep">
          <b>초안이에요.</b> 정식 공개 전에 운영자 정보와 세부 내용을 확정하고 전문가 검토를 받은 뒤 바뀔 수 있어요.
          바뀌면 다시 동의를 받아요. <b>[확인 필요]</b> 표시는 아직 정하지 않은 부분이에요.
        </p>
      )}
      <div className="legal-doc mt-8 grid gap-6 text-[15px] leading-relaxed text-ink-soft">{children}</div>
      <p className="mt-10 text-sm text-mute">
        <Link href="/terms" className="hover:text-mocha">이용약관</Link> · <Link href="/privacy" className="hover:text-mocha">개인정보처리방침</Link>
      </p>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-mocha-tint px-1 text-mocha-deep">[확인 필요] {children}</mark>;
}
