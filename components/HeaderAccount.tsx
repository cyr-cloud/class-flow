"use client";

// 상단 바 오른쪽 계정 버튼: 로그인 전 「로그인」, 로그인 뒤 「마이페이지」, 관리자는 「관리자」도.
// 실시간 수업 화면(/teacher, /student)에서는 숨긴다 — 수업 중에 눌러 수업에서 나가지 않게.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Status = { enabled: boolean; signedIn: boolean; admin: boolean };

const HIDDEN = /^\/(teacher|student|login|auth)(\/|$)/;

export function accountHidden(pathname: string) {
  return HIDDEN.test(pathname);
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
  return (
    <div className="flex items-center gap-1">
      {/* 휴대폰 폭에서는 자리가 모자라 「관리자」는 마이페이지 안의 버튼으로 간다 */}
      {status.admin && <Link href="/admin" className={`${linkClass} hidden sm:inline-flex`}>관리자</Link>}
      <Link href="/me" className={linkClass}>마이페이지</Link>
    </div>
  );
}
