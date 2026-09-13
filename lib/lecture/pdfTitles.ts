// PDF 각 페이지에서 제목 한 줄 뽑기.
//
// 교안 md 없이 PDF만 올렸을 때 실습·퀴즈 슬라이드를 알아보려고 쓴다.
// 본문이 이미지로 된 덱이 많아 대개 제목만 텍스트로 남아 있는데, 실습·퀴즈 판별에는 그거면 된다.

import { loadPdf } from "../sync/pdfStore";

interface TextItem {
  str: string;
  transform: number[];
}

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

/** 한 페이지의 텍스트 조각들을 y좌표로 묶어 줄 단위로 만든 뒤, 글자가 가장 큰 줄을 고른다 */
function pickTitle(items: TextItem[]): string {
  const lines = new Map<string, { size: number; y: number; parts: string[] }>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]);
    const y = Math.round(it.transform[5]);
    const key = String(y);
    const line = lines.get(key);
    if (line) {
      line.parts.push(it.str);
      line.size = Math.max(line.size, size);
    } else {
      lines.set(key, { size, y, parts: [it.str] });
    }
  }
  const all = [...lines.values()].map((l) => ({
    size: l.size,
    y: l.y,
    text: l.parts.join("").replace(/\s+/g, " ").trim(),
  }));
  if (all.length === 0) return "";

  // 가장 큰 글자 → 같으면 페이지 위쪽(y가 큰 쪽)
  all.sort((a, b) => b.size - a.size || b.y - a.y);
  return all[0].text;
}

/** IndexedDB에 저장된 PDF에서 페이지별 제목 배열을 만든다 */
export async function extractTitles(pdfKey: string): Promise<string[]> {
  const bytes = await loadPdf(pdfKey);
  if (!bytes) return [];
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  try {
    const titles: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      titles.push(pickTitle(content.items as unknown as TextItem[]));
    }
    return titles;
  } finally {
    await doc.destroy();
  }
}
