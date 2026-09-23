import { PDFDocument } from "pdf-lib";
import type { DeckSlide } from "../types";

/** 원본 PDF는 재촬영하지 않고 복사한다. 추가 페이지만 PNG로 삽입한다. */
export async function mergeLessonPdf(source: ArrayBuffer, slides: DeckSlide[], render: (slide: DeckSlide) => Promise<Uint8Array | Uint8Array[]>) {
  const original = await PDFDocument.load(source);
  const result = await PDFDocument.create();
  const pdfSlides = slides.filter(s => !s.content);
  const indices = pdfSlides.map(s => (s.pdfPage ?? s.slideNo) - 1);
  if (indices.some(i => i < 0 || i >= original.getPageCount())) throw new Error("원본 PDF와 수업 페이지가 맞지 않아요. 자료를 확인해 주세요.");
  const copied = await result.copyPages(original, indices);
  let next = 0;
  for (const slide of slides) {
    if (!slide.content) { result.addPage(copied[next++]); continue; }
    const rendered = await render(slide);
    for (const bytes of (Array.isArray(rendered) ? rendered : [rendered])) {
    const png = await result.embedPng(bytes);
    const page = result.addPage([960, 540]);
    page.drawImage(png, { x: 0, y: 0, width: 960, height: 540 });
    }
  }
  result.setTitle("ClassFlow 수업 자료");
  return result.save();
}



