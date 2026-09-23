import { renderSurveyPdf } from "./renderSurveyPdf";
import { wordCloudColor } from "./wordCloudColors";
import { mergeLessonPdf } from "./mergeLessonPdf";
import type { DeckSlide } from "../types";
import type { LiveState } from "../live/types";
import { loadPdf } from "../sync/pdfStore";

function wrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = "";
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line) { ctx.fillText(line, x, y); line = ""; y += lineHeight; }
    line += char;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

export async function renderAddedPage(slide: DeckSlide, responses: LiveState["wordResponses"]): Promise<Uint8Array> {
  const content = slide.content;
  if (!content) throw new Error("추가 페이지가 아니에요.");
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = 900;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF 페이지를 만들 수 없어요.");
  ctx.fillStyle = "#faf7f2"; ctx.fillRect(0, 0, 1600, 900);
  if (content.type === "image") {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("추가한 이미지를 불러오지 못했어요.")); image.src = content.imageUrl; });
    const scale = Math.min(1600 / image.naturalWidth, 900 / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    ctx.drawImage(image, (1600 - width) / 2, (900 - height) / 2, width, height);
  } else {
    ctx.fillStyle = "#8b6755"; ctx.font = '28px "Malgun Gothic", sans-serif';
    ctx.fillText("CLASSFLOW · 워드클라우드", 65, 65);
    ctx.fillStyle = "#262626"; ctx.font = 'bold 40px "Malgun Gothic", sans-serif';
    const startY = wrapped(ctx, content.prompt, 65, 130, 1470, 52) + 20;
    const rows = (responses ?? []).filter(r => r.slideId === content.id);
    const counts = new Map<string, { word: string; count: number }>();
    for (const r of rows) { const key = r.word.toLocaleLowerCase(); const old = counts.get(key); if (old) old.count++; else counts.set(key, { word: r.word, count: 1 }); }
    const words = [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));
    const cols = words.length > 30 ? 5 : words.length > 6 ? 3 : 2;
    const cellW = 1470 / cols, cellH = Math.min(135, (810 - startY) / Math.max(1, Math.ceil(words.length / cols)));
    ctx.textAlign = "center";
    for (const [i, word] of words.entries()) {
      let font = Math.min(cellH * 0.7, 25 + 40 * word.count / words[0].count);
      const label = `${word.word} (${word.count})`;
      ctx.font = `bold ${font}px "Malgun Gothic", sans-serif`;
      while (ctx.measureText(label).width > cellW - 20 && font > 8) { font--; ctx.font = `bold ${font}px "Malgun Gothic", sans-serif`; }
        ctx.fillStyle = wordCloudColor(word.word);
      ctx.fillText(label, 65 + cellW * (i % cols + 0.5), startY + cellH * (Math.floor(i / cols) + 0.7));
    }
    if (!words.length) { ctx.font = '32px "Malgun Gothic", sans-serif'; ctx.fillText("아직 참여한 단어가 없어요.", 800, 480); }
    ctx.textAlign = "left"; ctx.font = '24px "Malgun Gothic", sans-serif'; ctx.fillStyle = "#777777";
    ctx.fillText(`${rows.length}명 참여 · 다운로드 시점의 결과`, 65, 855);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("이미지 변환에 실패했어요.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function downloadLessonPdf(state: LiveState) {
  if (!state.session.pdfKey || !state.deck?.slides.length) throw new Error("자료를 먼저 불러와 주세요.");
  const source = await loadPdf(state.session.pdfKey);
  if (!source) throw new Error("원본 PDF를 불러오지 못했어요.");
  let total = state.deck.slides.filter(slide => !slide.content).length;
  const bytes = await mergeLessonPdf(source, state.deck.slides, async slide => {
    const rendered = await (slide.content?.type === "survey" ? renderSurveyPdf(slide.content, state.surveyResponses ?? []) : renderAddedPage(slide, state.wordResponses));
    total += Array.isArray(rendered) ? rendered.length : 1;
    return rendered;
  });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url;
  a.download = `${(state.session.pdfName ?? "ClassFlow").replace(/\.(pdf|pptx)$/i, "").replace(/[\\/:*?"<>|]/g, "_")}-수업자료.pdf`;
  a.click();
  return { total, url };
}



