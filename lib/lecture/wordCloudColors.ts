// 워드클라우드 글자색.
//
// 예전에는 단어를 해시해서 색을 골랐는데, 단어가 스무 개만 돼도 절반이 같은 색으로 겹치고
// 비슷한 보라·자주 계열에 몰렸다. 지금은 그 화면에 있는 단어끼리 색이 겹치지 않게 나눠 준다.

// 이웃한 색끼리 색상이 확 다르도록 순서를 섞어 둔 팔레트. 밝은 바탕(#faf7f2)에서 읽히는 진하기만 쓴다.
export const WORD_COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0d9488",
  "#d97706", "#db2777", "#0891b2", "#65a30d", "#4f46e5", "#b45309",
  "#dc2626", "#0369a1", "#c026d3", "#047857",
];

function hash(word: string): number {
  let value = 2166136261;
  for (const character of word) value = Math.imul(value ^ character.codePointAt(0)!, 16777619);
  return value >>> 0;
}

/**
 * 응답 목록(들어온 순서)을 받아 단어 → 색을 정한다.
 *
 * 단어마다 해시로 정한 자리에서 시작해 아직 안 쓴 색을 찾는다. 그래서 팔레트 수만큼은 색이
 * 하나도 겹치지 않고, 그보다 많아지면 다시 한 바퀴 돈다. 먼저 나온 단어부터 정하므로
 * 응답 수가 바뀌어 단어 크기·위치가 달라져도 색은 그대로다.
 */
export function assignWordColors(responses: { word: string }[]): (word: string) => string {
  const colors = new Map<string, string>();
  let used = new Set<number>();
  for (const { word } of responses) {
    const key = word.toLocaleLowerCase();
    if (colors.has(key)) continue;
    if (used.size === WORD_COLORS.length) used = new Set();
    let index = hash(key) % WORD_COLORS.length;
    while (used.has(index)) index = (index + 1) % WORD_COLORS.length;
    used.add(index);
    colors.set(key, WORD_COLORS[index]);
  }
  return (word) => colors.get(word.toLocaleLowerCase()) ?? WORD_COLORS[hash(word.toLocaleLowerCase()) % WORD_COLORS.length];
}
