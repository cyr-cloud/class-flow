// 교안(slide-content.md) → 슬라이드 구성 파서.
//
// 강의 교안이 지키는 규격을 그대로 읽는다:
//   ## 슬라이드 13: 퀴즈 1 — 이 상황엔 뭘 꺼낼까요?
//   **[슬라이드 텍스트]** … 보기: ① Chat ② Cowork ③ Design ④ Code
//   **[학생 참여 요소]**
//   Q. 세 문제 답을 채팅에 순서대로!
//   정답: 1번 ③ Design / 2번 ② Cowork / 3번 ① Chat
//
// 정답 줄은 세 가지 꼴이 있다:
//   "정답: 자유 — …"            → 정답 없는 설문
//   "정답: ② Cowork"            → 한 문항
//   "정답: 1번 ③ / 2번 ② / …"   → 한 슬라이드에 여러 문항 (보기 공유)

import { DeckSlide, QuizItem, SlideKind } from "../types";

const CIRCLES = "①②③④⑤⑥⑦⑧⑨";

/** ①②③ 로 나뉜 한 줄을 선택지 배열로 */
function splitOptions(line: string): string[] {
  const re = new RegExp(`([${CIRCLES}])\\s*([^${CIRCLES}]*)`, "g");
  const out: string[] = [];
  for (const m of line.matchAll(re)) {
    out.push(m[2].trim().replace(/^[.·\-—\s]+|[.\s]+$/g, ""));
  }
  return out;
}

function circleIndex(ch: string): number {
  return CIRCLES.indexOf(ch);
}

/** `**[이름]**` 블록 본문 꺼내기 */
function section(body: string, name: string): string {
  const re = new RegExp(`\\*\\*\\[${name}\\]\\*\\*\\n([\\s\\S]*?)(?=\\n\\*\\*\\[|\\n---|$)`);
  return body.match(re)?.[1].trim() ?? "";
}

/** 제목에서 장식 기호와 실습 표기를 걷어낸 표시용 제목 */
function cleanTitle(raw: string): string {
  return raw
    // 실습 번호는 화면에서 따로 배지로 보여주므로 제목에서는 뺀다
    .replace(/^\[실습\s*\d+\]\s*/, "")
    .replace(/^실습\s*\d+\s*[:：]\s*/, "")
    .replace(/[★♻️💥📋]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function slideKindOf(title: string): { kind: SlideKind; labNo: number | null } {
  const lab = title.match(/\[?실습\s*(\d+)\]?\s*[::\]]?/);
  if (lab && /\[실습\s*\d+\]/.test(title)) {
    return { kind: "lab", labNo: Number(lab[1]) };
  }
  // "실습 3: 주제명" 형식(대괄호 없이)도 실습으로 본다
  const plain = title.match(/^실습\s*(\d+)\s*[:：]/);
  if (plain) return { kind: "lab", labNo: Number(plain[1]) };
  if (/^\[?\s*퀴즈/.test(title.trim())) return { kind: "quiz", labNo: null };
  return { kind: "normal", labNo: null };
}

function itemId(slideNo: number, no: number): string {
  return `q${slideNo}_${no}`;
}

/**
 * 문항 줄(`Q. …`)을 찾는다.
 * 교안에 따라 참여요소 블록에 있기도 하고(유코의 아지트), 슬라이드 텍스트에
 * `**Q. …**` 로 굵게 들어가 있기도 하다(전주 ICT). 양쪽 다 읽는다.
 */
function findQuestion(text: string): string {
  const m = text.match(/^\s*\**Q\.\s*(.+?)\**\s*$/m);
  return m ? m[1].replace(/\*\*/g, "").trim() : "";
}

/** 한 슬라이드 블록에서 참여요소 문항들을 뽑는다 */
function parseItems(slideNo: number, body: string): QuizItem[] {
  const part = section(body, "학생 참여 요소");
  if (!part) return [];

  const slideText = section(body, "슬라이드 텍스트");
  const question = findQuestion(part) || findQuestion(slideText);

  // 선택지: 참여요소 블록 안에 있으면 그것을, 없으면 슬라이드 텍스트의 "보기:" 줄을.
  // 정답 줄에도 ①②③이 들어 있으니("정답: 1번 ③ / 2번 ②") 그 줄은 반드시 건너뛴다.
  const optionLine = part
    .split("\n")
    .filter((l) => !/^\s*(정답|예)\s*[:：]/.test(l))
    .find((l) => (l.match(new RegExp(`[${CIRCLES}]`, "g")) ?? []).length >= 2);
  let options = optionLine ? splitOptions(optionLine) : [];
  if (options.length === 0) {
    const bogi = slideText.match(/^보기\s*[:：]\s*(.+)$/m);
    if (bogi) options = splitOptions(bogi[1]);
  }
  if (options.length === 0) {
    // 선택지를 줄마다 하나씩 적어둔 슬라이드도 있다 ("① 엑셀 파일 만들기" 줄 4개)
    options = slideText
      .split("\n")
      .map((l) => l.trim().replace(/^[-*]\s*/, "").replace(/^\*\*|\*\*$/g, ""))
      .filter((l) => new RegExp(`^[${CIRCLES}]`).test(l))
      .map((l) => l.slice(1).trim());
  }
  if (options.length < 2 || !question) return [];

  const answerLine = part.match(/^정답\s*[:：]\s*(.+)$/m)?.[1].trim() ?? "";

  // "1번 ③ / 2번 ② / 3번 ①" — 한 슬라이드에 문항이 여럿, 보기는 공유
  const multi = [...answerLine.matchAll(new RegExp(`(\\d+)번\\s*([${CIRCLES}])`, "g"))];
  if (multi.length > 1) {
    // 문항 텍스트는 슬라이드 텍스트의 "1. …" 번호 줄에서 가져온다
    const numbered = section(body, "슬라이드 텍스트")
      .split("\n")
      .map((l) => l.match(/^\s*(\d+)\.\s*(.+)$/))
      .filter((m): m is RegExpMatchArray => m !== null);

    return multi.map((m) => {
      const no = Number(m[1]);
      const text = numbered.find((n) => Number(n[1]) === no)?.[2];
      return {
        id: itemId(slideNo, no),
        slideNo,
        no,
        question: (text ?? `${no}번`).replace(/\*\*/g, "").trim(),
        options,
        answers: [circleIndex(m[2])],
      };
    });
  }

  // "자유 — …" 는 정답 없는 설문.
  // 괄호 뒤는 해설이라 잘라낸다 — "정답: ① 엑셀, ③ PPT (②Cowork·④Design은 Pro 이상)"에서
  // 괄호 안 번호까지 정답으로 세면 전부 정답이 되어버린다.
  const free = /^자유/.test(answerLine);
  const answerPart = answerLine.split("(")[0];
  const answers = free
    ? []
    : [...answerPart.matchAll(new RegExp(`[${CIRCLES}]`, "g"))]
        .map((m) => circleIndex(m[0]))
        .filter((i) => i < options.length);

  return [
    {
      id: itemId(slideNo, 1),
      slideNo,
      no: 1,
      question: question.replace(/\*\*/g, ""),
      options,
      answers: [...new Set(answers)],
    },
  ];
}

/** 교안 마크다운 전체 → 슬라이드 배열 */
export function parseDeckMarkdown(source: string): DeckSlide[] {
  // 윈도우에서 만든 교안은 줄바꿈이 CRLF라, 줄 단위 정규식이 전부 빗나간다. 먼저 통일한다.
  const md = source.replace(/\r\n?/g, "\n");
  const slides: DeckSlide[] = [];
  const heading = /^##\s*슬라이드\s*(\d+)\s*[:：]\s*(.*)$/gm;

  const marks = [...md.matchAll(heading)];
  marks.forEach((m, i) => {
    const slideNo = Number(m[1]);
    const rawTitle = m[2].trim();
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : md.length;
    const body = md.slice(start, end);

    const { kind, labNo } = slideKindOf(rawTitle);
    slides.push({
      slideNo,
      title: cleanTitle(rawTitle),
      kind,
      labNo,
      boardId: null,
      // 교안은 슬라이드마다 [학생 참여 요소]가 있다(채팅 질문용). 앱에서 문항으로 띄우는 건
      // 제목이 "퀴즈 N"인 슬라이드뿐이다.
      items: kind === "quiz" ? parseItems(slideNo, body) : [],
    });
  });

  return slides.sort((a, b) => a.slideNo - b.slideNo);
}

/** PDF에서 뽑은 페이지별 제목만으로 구성 만들기 (교안 md가 없을 때) */
export function deckFromTitles(titles: string[]): DeckSlide[] {
  return titles.map((raw, i) => {
    const title = raw.trim();
    const { kind, labNo } = slideKindOf(title);
    return {
      slideNo: i + 1,
      title: cleanTitle(title) || `슬라이드 ${i + 1}`,
      kind,
      labNo,
      boardId: null,
      items: [],
    };
  });
}
