// 수업 상태·게시판을 담는 공유 키-값 저장소.
//
// 로컬 개발에서는 `.classflow` 폴더의 파일, 배포(Vercel)에서는 Upstash Redis를 쓴다.
// Vercel 함수는 파일시스템이 읽기 전용인 데다 요청마다 다른 인스턴스로 갈 수 있어서,
// 파일로 두면 강사가 넘긴 슬라이드가 학생 화면에 전달되지 않는다.
//
// 환경변수(UPSTASH_REDIS_REST_URL·UPSTASH_REDIS_REST_TOKEN)가 없으면 파일로 떨어진다.
// 그래야 받아서 `npm run dev`만 해도 아무 설정 없이 돌아간다.
//
// 학생 여러 명이 거의 동시에 응답하면 read-modify-write가 서로를 덮어쓴다.
// 그래서 쓰기는 전부 "읽어둔 값이 그대로일 때만 쓴다"(compare-and-set)로 하고,
// 실패하면 호출한 쪽이 다시 읽어서 얹는다.

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface Kv {
  get(key: string): Promise<string | null>;
  /**
   * 저장된 값이 `prev`와 같을 때만 `next`로 바꾼다.
   * `prev`가 null이면 "아직 값이 없을 때만" 쓴다. 바뀌어 있으면 false.
   */
  compareAndSet(key: string, prev: string | null, next: string): Promise<boolean>;
}

// ── 파일 구현 (로컬) ─────────────────────────────────────────────────
// Node는 단일 스레드라, 중간에 await 없이 동기 fs만 쓰면 읽기→쓰기 사이가 끼어들지 않는다.

const folder = path.join(process.cwd(), ".classflow");

function fileOf(key: string): string {
  // 키에 `:`가 들어가는데 윈도우 파일명에 못 쓴다
  return path.join(folder, `${key.replace(/:/g, "_")}.json`);
}

const fileKv: Kv = {
  async get(key) {
    const file = fileOf(key);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  },

  async compareAndSet(key, prev, next) {
    const file = fileOf(key);
    mkdirSync(folder, { recursive: true });
    // Windows 동기화/백신이 잠깐 파일을 잡을 수 있다. 대기 뒤에는 CAS를 다시
    // 확인하므로 그 사이 저장된 다른 참가자의 답변을 덮어쓰지 않는다.
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = existsSync(file) ? readFileSync(file, "utf8") : null;
      if (current !== prev) return false;
      try {
        writeFileSync(`${file}.tmp`, next);
        renameSync(`${file}.tmp`, file);
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt === 7 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw error;
        await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1)));
      }
    }
    return false;
  },
};

// ── Upstash Redis 구현 (배포) ────────────────────────────────────────
// REST API라 fetch만으로 충분하다 — 패키지를 더 얹지 않는다.

// 읽어둔 값이 그대로일 때만 덮어쓴다. 문자열을 통째로 비교하므로 JSON을 파싱할 필요가 없다.
const CAS = `
local current = redis.call('GET', KEYS[1])
local expected = ARGV[2]
if (current == false and expected == '') or (current ~= false and current == expected) then
  redis.call('SET', KEYS[1], ARGV[1])
  return 1
end
return 0
`;

function upstash(): Kv | null {
  // 로컬 검증 시 .env의 운영 Redis가 설정돼 있어도 접근하지 않는다.
  if (process.env.CLASSFLOW_LOCAL_ONLY === "1" && !process.env.VERCEL) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  async function call(command: unknown[]): Promise<unknown> {
    const res = await fetch(url!.replace(/\/$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    const body = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(body.error ?? `저장소 오류 (${res.status})`);
    return body.result ?? null;
  }

  return {
    async get(key) {
      const result = await call(["GET", key]);
      return typeof result === "string" ? result : null;
    },
    async compareAndSet(key, prev, next) {
      // 값이 없는 경우를 빈 문자열로 넘긴다 (Lua에 nil을 인자로 줄 수 없다)
      const result = await call(["EVAL", CAS, "1", key, next, prev ?? ""]);
      return Number(result) === 1;
    },
  };
}

let cached: Kv | null = null;

export function kv(): Kv {
  if (!cached) cached = upstash() ?? fileKv;
  return cached;
}

/** 배포에서 공유 저장소가 붙어 있는지 — 화면에 안내를 띄우는 데 쓴다 */
export function isShared(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

