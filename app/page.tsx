"use client";

// 첫 화면. 강사인지 학생인지부터 고르게 한다 —
// 둘이 하는 일이 완전히 달라서(자료를 올린다 / 코드로 들어온다) 먼저 갈라주는 게 덜 헤맨다.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

function newCode() {
  return Math.random().toString(36).slice(2, 8);
}

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const join = () => {
    const id = code.trim().toLowerCase();
    if (!id) {
      setError("강사님이 알려주신 코드를 입력해 주세요.");
      return;
    }
    if (!/^[a-z0-9_-]{1,64}$/.test(id)) {
      setError("코드는 영문과 숫자로 되어 있어요. 다시 확인해 주세요.");
      return;
    }
    router.push(`/student/${id}`);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <p className="eyebrow">ClassFlow</p>
      <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.15] text-ink sm:text-5xl">
        아직도 수업 때
        <br />
        <span className="text-mocha">보여주기만</span> 하시나요?
      </h1>
      <p className="mt-5 max-w-xl text-lg font-medium text-ink-soft">
        학생과 한 화면으로 소통하면서 수업해보세요.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {/* 강사 */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper">
          {/* 인물이 판 아래쪽에 서 있게 둬서 카드와 이어져 보이게 한다 */}
          <div className="flex h-44 items-end justify-center bg-gardenia">
            <Image
              src="/illustrations/teacher.webp"
              alt=""
              width={615}
              height={640}
              priority
              className="h-[168px] w-auto object-contain object-bottom"
            />
          </div>
          <div className="flex flex-1 flex-col p-7">
          <span className="w-fit rounded-full bg-ink px-5 py-2 text-lg font-bold text-white sm:text-xl">
            강사
          </span>
          <h2 className="mt-4 text-2xl font-bold text-ink">수업 열기</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
            PDF를 올려 학생과 같은 슬라이드를 보며 수업하세요. 자료가 없으시면 샘플로
            1분 만에 둘러보셔도 됩니다.
          </p>
          <button
            onClick={() => router.push(`/teacher/${newCode()}`)}
            className="mt-7 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-mocha-deep"
          >
            PDF 올리러 가기 →
          </button>
          </div>
        </section>

        {/* 학생 */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex h-44 items-end justify-center bg-mocha-tint">
            <Image
              src="/illustrations/student.webp"
              alt=""
              width={627}
              height={640}
              priority
              className="h-[168px] w-auto object-contain object-bottom"
            />
          </div>
          <div className="flex flex-1 flex-col p-7">
          <span className="w-fit rounded-full bg-mocha px-5 py-2 text-lg font-bold text-white sm:text-xl">
            학생
          </span>
          <h2 className="mt-4 text-2xl font-bold text-ink">수업 참여</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-ink-soft">
            강사님이 알려주신 코드만 넣으면 들어갑니다. 가입도, 설치도 없습니다.
          </p>
          <div className="mt-7 flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="참여 코드"
              aria-label="참여 코드"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-cream px-5 py-3 text-sm text-ink outline-none placeholder:text-mute focus:border-mocha"
            />
            <button
              onClick={join}
              className="shrink-0 rounded-full bg-mocha px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-mocha-deep"
            >
              입장
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rosetan">
              {error}
            </p>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}
