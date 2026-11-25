// 이 브라우저에서 학생으로 참여한 수업 목록 (2026-11-25, 「내 강의실」 v1.5 준비).
//
// 로그인하지 않고 참여한 학생도 나중에 같은 브라우저로 로그인하면
// "이 브라우저에서 참여한 수업"을 내 강의실로 가져올 수 있게, 참여할 때마다 여기에 남긴다.
// 서버로는 보내지 않는다 — 이 브라우저의 localStorage에만 있다.
// responderIds는 퀴즈 응답·제출물에 붙는 탭 식별자(sessionStorage)라, 나중에 내 기록을 이어 붙일 때 쓴다.

export const JOINED_KEY = "classflow:joined";
export const MAX_CLASSES = 200;
export const MAX_RESPONDERS = 20;

export interface JoinedClass {
  code: string;
  title: string;
  firstAt: string; // ISO
  lastAt: string; // ISO
  responderIds: string[];
  name?: string; // 채팅에 쓴 이름(있으면)
}

export interface JoinInput {
  code: string;
  title: string;
  responderId: string;
  name?: string;
  now: Date;
}

const clip = (s: string, n: number) => s.trim().slice(0, n);

// 저장된 값을 믿지 않고 모양이 맞는 항목만 남긴다.
export function parseJoined(raw: string | null): JoinedClass[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const list: unknown[] = Array.isArray(data?.classes) ? data.classes : [];
    return list
      .filter((c): c is JoinedClass => {
        const v = c as JoinedClass;
        return !!v && typeof v.code === "string" && !!v.code && typeof v.title === "string"
          && typeof v.firstAt === "string" && typeof v.lastAt === "string" && Array.isArray(v.responderIds);
      })
      .map((c) => ({
        code: c.code,
        title: c.title,
        firstAt: c.firstAt,
        lastAt: c.lastAt,
        responderIds: c.responderIds.filter((r) => typeof r === "string" && !!r).slice(-MAX_RESPONDERS),
        ...(typeof c.name === "string" && c.name ? { name: c.name } : {}),
      }))
      .slice(0, MAX_CLASSES);
  } catch {
    return [];
  }
}

export function serializeJoined(list: JoinedClass[]): string {
  return JSON.stringify({ v: 1, classes: list });
}

// 참여 한 번을 목록에 얹는다. 같은 수업이면 갱신해서 맨 앞으로, 처음이면 새로 넣는다.
export function recordJoin(list: JoinedClass[], input: JoinInput): JoinedClass[] {
  const code = clip(input.code, 64);
  if (!code || !input.responderId) return list;
  const now = input.now.toISOString();
  const title = clip(input.title, 120);
  const name = input.name ? clip(input.name, 30) : "";
  const old = list.find((c) => c.code === code);
  const responderIds = old
    ? [...old.responderIds.filter((r) => r !== input.responderId), input.responderId].slice(-MAX_RESPONDERS)
    : [input.responderId];
  const next: JoinedClass = {
    code,
    title: title || old?.title || "",
    firstAt: old?.firstAt ?? now,
    lastAt: now,
    responderIds,
    ...(name || old?.name ? { name: name || old?.name } : {}),
  };
  return [next, ...list.filter((c) => c.code !== code)].slice(0, MAX_CLASSES);
}

// 브라우저에서 호출. 시크릿 모드·저장 공간 부족 등은 조용히 넘어간다(수업 참여를 막지 않는다).
export function rememberJoinedClass(input: Omit<JoinInput, "now">): void {
  try {
    const current = parseJoined(window.localStorage.getItem(JOINED_KEY));
    window.localStorage.setItem(JOINED_KEY, serializeJoined(recordJoin(current, { ...input, now: new Date() })));
  } catch {
    /* 무시 */
  }
}

export function readJoinedClasses(): JoinedClass[] {
  try {
    return parseJoined(window.localStorage.getItem(JOINED_KEY));
  } catch {
    return [];
  }
}
