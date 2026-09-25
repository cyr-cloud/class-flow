const WORD_COLORS = [
  "#e11d48", "#2563eb", "#0d9488", "#9333ea", "#ea580c", "#0284c7",
  "#db2777", "#16a34a", "#4f46e5", "#c026d3", "#b77900", "#0891b2",
  "#dc2626", "#7c3aed", "#059669", "#c2410c", "#a21caf", "#0369a1",
];

// A word keeps its color when response counts change its position in the cloud.
export function wordCloudColor(word: string): string {
  let hash = 2166136261;
  for (const character of word.toLocaleLowerCase()) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return WORD_COLORS[(hash >>> 0) % WORD_COLORS.length];
}
