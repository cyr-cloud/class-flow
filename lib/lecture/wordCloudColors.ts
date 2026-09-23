const WORD_COLORS = [
  "#c03553", "#b45309", "#9a6500", "#427b28", "#087c70",
  "#087ba5", "#3264c8", "#6546c0", "#a035a0", "#c03978",
];

// A word keeps its color when response counts change its position in the cloud.
export function wordCloudColor(word: string): string {
  let hash = 2166136261;
  for (const character of word.toLocaleLowerCase()) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return WORD_COLORS[(hash >>> 0) % WORD_COLORS.length];
}
