"use client";

// 상단 바 오른쪽 계정 버튼: 로그인 전 「로그인」, 로그인 뒤 「마이페이지」, 관리자는 「관리자」도.
// 모든 화면에 둔다(2026-11-26 사용자 결정). 로그인 화면에서만 뺀다.
// 학생 수업 화면에서는 「마이페이지」·「관리자」를 새 탭으로 열어 수업 화면이 닫히지 않게 한다.
// 「로그인」은 끝나면 next로 같은 수업에 돌아오므로 같은 탭(새 탭이면 응답자 식별자가 새로 생겨 한 학생이 두 명으로 세어진다).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Status = { enabled: boolean; signedIn: boolean; admin: boolean };

const HIDDEN = /^\/(login|auth)(\/|$)/;
const IN_CLASS = /^\/student(\/|$)/;

export function accountHidden(pathname: string) {
  return HIDDEN.test(pathname);
}

// 학생 수업 중이면 계정 화면을 새 탭으로 연다.
export function opensInNewTab(pathname: string) {
  return IN_CLASS.test(pathname);
}

const linkClass =
  "rounded-full px-3 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mocha";

export default function HeaderAccount() {
  const pathname = usePathname() ?? "/";
  const hidden = accountHidden(pathname);
  const [status, setStatus] = useState<Status | null>(null);

  // 화면을 옮길 때마다 다시 확인한다(로그인·로그아웃 직후 바로 바뀌게).
  useEffect(() => {
    if (hidden) return;
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => { if (active) setStatus(s); })
      .catch(() => { if (active) setStatus(null); });
    return () => { active = false; };
  }, [pathname, hidden]);

  if (hidden || !status?.enabled) return null;
  if (!status.signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={`${linkClass} bg-white/10 text-white`}>
        로그인
      </Link>
    );
  }
  const newTab = opensInNewTab(pathname) ? { target: "_blank", rel: "noopener" } : {};
  return (
    <div className="flex items-center gap-1">
      {/* 휴대폰 폭에서는 자리가 모자라 「관리자」는 마이페이지 안의 버튼으로 간다 */}
      {status.admin && <Link href="/admin" {...newTab} className={`${linkClass} hidden sm:inline-flex`}>관리자</Link>}
      <Link href="/me" {...newTab} className={linkClass}>마이페이지</Link>
    </div>
  );
}
