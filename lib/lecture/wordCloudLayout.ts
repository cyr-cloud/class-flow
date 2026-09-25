export interface CloudWord { word: string; count: number }
export interface PlacedWord extends CloudWord { x: number; y: number; width: number; height: number; fontSize: number }
export const CLOUD_WIDTH = 1000;
export const CLOUD_HEIGHT = 520;

export function groupCloudWords(responses: { word: string }[]): CloudWord[] {
  const counts = new Map<string, CloudWord>();
  for (const { word } of responses) {
    const key = word.toLocaleLowerCase();
    const previous = counts.get(key);
    if (previous) previous.count++; else counts.set(key, { word, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));
}

function seed(word: string) {
  let value = 2166136261;
  for (const char of word) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return (value >>> 0) / 4294967296;
}
function units(word: string) {
  return Array.from(word).reduce((sum, char) => sum + (/\s/.test(char) ? 0.35 : /[\x00-\x7f]/.test(char) ? 0.62 : 1), 0);
}
export function cloudBoxesOverlap(a: PlacedWord, b: PlacedWord) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 9 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 9;
}

/** Seeded spiral packing: scattered positions without jitter on polling/reloads. */
export function layoutCloud(input: CloudWord[]): PlacedWord[] {
  const words = [...input].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));
  if (!words.length) return [];
  const max = words[0].count;
  for (let pass = 0; pass < 18; pass++) {
    const placed: PlacedWord[] = [];
    const scale = Math.pow(0.85, pass);
    for (const item of words) {
      const size = max === 1 ? 48 : 22 + 86 * Math.sqrt((item.count - 1) / (max - 1));
      const fontSize = Math.min(size * scale, 760 / Math.max(units(item.word), 1));
      const width = Math.max(1, units(item.word)) * fontSize;
      const height = fontSize * 1.25;
      const phase = seed(item.word) * Math.PI * 2;
      let position: PlacedWord | undefined;
      for (let step = 0; step < 2400; step++) {
        const radius = Math.sqrt(step) * 12;
        const angle = phase + step * 0.43;
        const box = { ...item, fontSize, width, height,
          x: 500 + Math.cos(angle) * radius,
          y: 260 + Math.sin(angle) * radius * 0.56 };
        if (box.x - width / 2 < 12 || box.x + width / 2 > 988 || box.y - height / 2 < 12 || box.y + height / 2 > 508) continue;
        if (!placed.some(other => cloudBoxesOverlap(box, other))) { position = box; break; }
      }
      if (!position) break;
      placed.push(position);
    }
    if (placed.length === words.length) return placed;
  }
  // Dense extreme inputs still retain every answer in non-overlapping cells.
  const cols = Math.ceil(Math.sqrt(words.length * CLOUD_WIDTH / CLOUD_HEIGHT));
  const rows = Math.ceil(words.length / cols), cellW = CLOUD_WIDTH / cols, cellH = CLOUD_HEIGHT / rows;
  return words.map((item, i) => {
    const fontSize = Math.min(22, (cellW - 14) / Math.max(units(item.word), 1), (cellH - 14) / 1.25);
    return { ...item, fontSize, width: Math.max(units(item.word), 1) * fontSize, height: fontSize * 1.25,
      x: (i % cols + 0.5) * cellW, y: (Math.floor(i / cols) + 0.5) * cellH };
  });
}
