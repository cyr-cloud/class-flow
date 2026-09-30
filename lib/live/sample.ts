// "샘플" 버튼이 여는 강의의 부속 자료 — 실습 안내문과 강사 예시 결과물.
//
// 빈 게시판을 처음 본 학생은 뭘 어디까지 올려야 할지 모른다. 그래서 실습마다
// 강사가 미리 올려둔 것처럼 예시가 한 개씩 들어가 있어야 한다.
//
// 예시 글의 ownerId는 어떤 브라우저와도 겹치지 않는 값이라(SEED_OWNER) 지우기 버튼이
// 뜨지 않는다. 수업 중에, 또는 심사 중에 누가 실수로 지우는 일이 없다.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DeckSlide, LabPost, QuizResponse } from "../types";

export const SEED_OWNER = "seed";
const SEED_AUTHOR = "최유라 강사";

/** 실습별 예시 결과물 설명. 이미지는 public/samples/gallery/lab-N.png */
const EXAMPLES: Record<number, string> = {
  6: "폴더를 붙인 다음 «연결된 폴더 안 파일과 폴더를 보여주세요» 라고 물어본 화면이에요. " +
     "01_docs 안에 월별 매출 파일 열두 개가 보이고, 02_output과 99_backup은 아직 비어 있습니다. " +
     "이렇게 목록이 나오면 폴더가 제대로 붙은 거예요.",
  7: "정리 결과물이 02_output 폴더에 실제 파일로 떨어진 화면입니다. " +
     "화면에 표로 보여주는 것과 파일로 만드는 건 다르니까, 탐색기를 열어 파일이 있는지 꼭 확인해 주세요.",
  8: "합친 결과를 «월별합계» 시트로 받아 검산한 화면이에요. " +
     "월별 원본 행수와 중복 행, 매출 합계를 나란히 놓으면 숫자가 맞는지 바로 보입니다. 440행에 중복 8건이 나왔습니다.",
  9: "카톡 나와의 채팅방으로 점검 결과가 도착한 화면입니다. " +
     "중복 8건, 점포정보 누락, 담당자 미기재 세 가지가 요약돼서 왔어요. 이렇게 오면 통로가 제대로 붙은 겁니다.",
  10: "매일 14시에 도는 예약 작업을 만들어 둔 화면이에요. " +
      "«이 컴퓨터 필요» 표시와 다음 실행 시각이 보이는지 확인해 주세요. 이게 없으면 예약이 돌지 않습니다.",
  11: "까만 창에서 git --version 을 쳐서 버전이 나온 화면입니다. " +
      "이렇게 버전이 찍히면 다음 회차 준비가 끝난 거예요.",
};

const GUIDE_DIR = "data/samples/guides";

// 안내문은 파일에서 읽어 붙인다 — 수업 기록에 박아 넣지 않는다.
// 박아 넣으면 그 뒤에 안내문을 고쳐도 이미 열린 수업에는 반영되지 않고,
// 기능이 생기기 전에 열린 수업에는 아예 안 들어 있다.
const cache = new Map<number, string | null>();
// 배포본에서는 파일이 바뀌지 않으니 한 번만 읽는다. 개발 중에는 안내문을 고치는 족족
// 화면에서 확인해야 하므로 캐시하지 않는다 (폴링마다 읽어도 파일 몇 개라 부담이 없다).
const CACHED = process.env.NODE_ENV === "production";

/** 실습 안내문(마크다운)을 읽어온다. 프런트매터는 걷어낸다. */
export function guideFor(labNo: number): string | null {
  if (CACHED) {
    const hit = cache.get(labNo);
    if (hit !== undefined) return hit;
  }

  const file = path.join(process.cwd(), GUIDE_DIR, `lab-${labNo}.md`);
  // ---\nlabNo: …\n--- 머리말은 화면에 필요 없다
  const guide = existsSync(file)
    ? readFileSync(file, "utf8").replace(/\r\n?/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, "").trim() || null
    : null;

  if (CACHED) cache.set(labNo, guide);
  return guide;
}

/** 실습 슬라이드마다 강사 예시 결과물 하나 */
export function seedPostsFor(labSlides: { slideNo: number; labNo: number | null }[]): LabPost[] {
  return labSlides.flatMap(({ slideNo, labNo }) => {
    if (labNo === null) return [];
    const description = EXAMPLES[labNo];
    if (!description) return [];
    return [{
      id: `seed_${labNo}`,
      slideNo,
      authorName: SEED_AUTHOR,
      description,
      imageUrl: `/samples/gallery/lab-${labNo}.png`,
      ownerId: SEED_OWNER,
      // 학생 글이 위로 쌓이도록 예시는 가장 오래된 것으로 둔다
      createdAt: 0,
    }];
  });
}

// ── 예시 학생 ─────────────────────────────────────────────────────────
// 샘플 수업을 열자마자 «학생 리포트»에 표가 채워져 있고, «학생 성향 분석»과
// «AI 피드백 달기»를 바로 눌러 볼 수 있게 가상의 학생 참여 기록을 넣어 둔다.
// 이름에 «(예시)»를 붙여 실제 학생과 헷갈리지 않게 한다. ownerId는 어떤 브라우저와도
// 겹치지 않는 값이라 학생 화면에서는 지울 수 없다 (강사는 지울 수 있다).

type DemoPost = { labNo: number; description: string; image: boolean; minutesAgo: number };
type DemoStudent = { id: string; name: string; answerRate: number; correctRate: number; posts: DemoPost[] };

const DEMO_STUDENTS: DemoStudent[] = [
  { id: "demo_minji", name: "민지(예시)", answerRate: 1, correctRate: 0.9, posts: [
    { labNo: 6, description: "폴더 붙이고 목록 보여달라고 했더니 01_docs 안에 월별 파일 12개가 나왔어요!", image: true, minutesAgo: 52 },
    { labNo: 8, description: "월별합계 시트로 받았어요. 440행에 중복 8건, 합계도 원본이랑 맞게 나왔습니다.", image: true, minutesAgo: 21 },
  ] },
  { id: "demo_seojun", name: "서준(예시)", answerRate: 1, correctRate: 0.5, posts: [
    { labNo: 7, description: "02_output에 엑셀이 생겼어요. 시트 이름이 영어로 나와서 한글로 바꿔 달라고 한 번 더 시켰어요.", image: true, minutesAgo: 38 },
  ] },
  { id: "demo_hayun", name: "하윤(예시)", answerRate: 0.8, correctRate: 0.7, posts: [
    { labNo: 9, description: "카톡 연결에서 막혔어요… 권한 허용 창이 안 떠서 앱을 껐다 켜고 다시 했더니 결과가 왔어요.", image: true, minutesAgo: 15 },
  ] },
  { id: "demo_doyun", name: "도윤(예시)", answerRate: 0.35, correctRate: 0.6, posts: [] },
  { id: "demo_jiwoo", name: "지우(예시)", answerRate: 0.7, correctRate: 0.3, posts: [
    { labNo: 6, description: "폴더는 붙였는데 02_output 폴더가 목록에 안 보여요 ㅠ 어디서 확인해야 하나요?", image: false, minutesAgo: 47 },
  ] },
  { id: "demo_yejun", name: "예준(예시)", answerRate: 0, correctRate: 0, posts: [
    { labNo: 10, description: "예약 작업 만들었어요. 매일 14시로 해 뒀고 «이 컴퓨터 필요» 표시도 보여요.", image: true, minutesAgo: 9 },
  ] },
];

/** 0~1 사이의 고정된 값 — 매번 같은 예시가 나오게 한다 */
const spread = (a: number, b: number) => ((a * 7 + b * 13 + 3) % 20) / 20;

export function seedDemoStudents(slides: DeckSlide[], now = Date.now()): { roster: Record<string, { name: string; at: number }>; responses: QuizResponse[]; posts: LabPost[] } {
  const items = slides.filter(s => s.kind === "quiz").flatMap(s => s.items).filter(q => q.options.length >= 2);
  const labSlide = new Map(slides.filter(s => s.kind === "lab" && s.labNo !== null).map(s => [s.labNo as number, s.slideNo]));
  const roster: Record<string, { name: string; at: number }> = {};
  const responses: QuizResponse[] = [];
  const posts: LabPost[] = [];

  DEMO_STUDENTS.forEach((student, p) => {
    roster[student.id] = { name: student.name, at: now - 60 * 60 * 1000 };
    items.forEach((item, k) => {
      if (spread(k, p) >= student.answerRate) return;
      let choices: number[];
      if (!item.answers.length) choices = [(k + p) % item.options.length];
      else if (spread(k + 11, p + 5) < student.correctRate) choices = [...item.answers];
      else choices = [item.options.findIndex((_, i) => !item.answers.includes(i))];
      responses.push({ itemId: item.id, responderId: student.id, choiceIndex: choices[0], choiceIndices: choices, createdAt: now - (items.length - k) * 4 * 60 * 1000 });
    });
    for (const post of student.posts) {
      const slideNo = labSlide.get(post.labNo);
      if (slideNo === undefined) continue;
      posts.push({
        id: `demo_${student.id}_${post.labNo}`, slideNo, authorName: student.name, description: post.description,
        imageUrl: post.image ? `/samples/gallery/lab-${post.labNo}.png` : null, ownerId: student.id, likes: [], createdAt: now - post.minutesAgo * 60 * 1000,
      });
    }
  });
  // 서로 누른 좋아요 몇 개
  const like = (postOwner: string, labNo: number, ...by: string[]) => { const post = posts.find(x => x.ownerId === postOwner && x.id.endsWith(`_${labNo}`)); if (post) post.likes = by; };
  like("demo_minji", 8, "demo_seojun", "demo_hayun", "demo_yejun");
  like("demo_hayun", 9, "demo_minji");
  return { roster, responses, posts };
}
