import type { SurveyContent, SurveyResponse } from './survey';
import { surveyCounts, SURVEY_COLORS } from './survey';

/** Export every answer, continuing on additional pages when needed. */
export async function renderSurveyPdf(content: SurveyContent, responses: SurveyResponse[]): Promise<Uint8Array[]> {
  await document.fonts.ready;
  const pages: Uint8Array[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF 페이지를 만들 수 없어요.');
  const rows = responses.filter(r => r.slideId === content.id);
  let y = 0;
  function lines(text: string, width: number) {
    const result: string[] = []; let line = '';
    for (const ch of text) {
      if (ch === '\n') { result.push(line); line = ''; continue; }
      if (line && ctx!.measureText(line + ch).width > width) { result.push(line); line = ''; }
      line += ch;
    }
    result.push(line); return result;
  }
  function start() {
    ctx!.fillStyle = '#faf7f2'; ctx!.fillRect(0, 0, 1600, 900);
    ctx!.fillStyle = '#262626'; ctx!.font = 'bold 34px "Malgun Gothic", sans-serif';
    y = 65;
    for (const line of lines(content.prompt, 1470)) { ctx!.fillText(line, 65, y); y += 44; }
    ctx!.font = '24px "Malgun Gothic", sans-serif';
    ctx!.fillText(`${rows.length}명 참여 · 다운로드 시점의 결과`, 65, 860);
    y += 20;
  }
  async function save() {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PDF 이미지 변환 실패')), 'image/png'));
    pages.push(new Uint8Array(await blob.arrayBuffer()));
  }
  start();
  if (content.display === 'cards') {
    ctx.font = '28px "Malgun Gothic", sans-serif';
    for (const [index, response] of rows.entries()) {
      const textLines = lines(`${index + 1}. ${response.text ?? ''}`, 1400);
      for (const line of textLines) {
        if (y > 785) { await save(); start(); ctx.font = '28px "Malgun Gothic", sans-serif'; }
        ctx.fillStyle = '#eae9e7'; ctx.fillRect(65, y - 28, 1470, 40);
        ctx.fillStyle = '#262626'; ctx.fillText(line, 85, y); y += 40;
      }
      y += 20;
    }
  } else {
    const counts = surveyCounts(content, rows); const total = counts.reduce((n, r) => n + r.count, 0);
    if (content.display !== 'bar') {
      const cy = y + 135; let angle = -Math.PI / 2;
      if (!total) { ctx.fillStyle = '#e2e0dc'; ctx.beginPath(); ctx.arc(800, cy, 120, 0, Math.PI * 2); ctx.fill(); }
      counts.forEach((r, i) => {
        const end = angle + (total ? r.count / total * Math.PI * 2 : 0);
        ctx.fillStyle = SURVEY_COLORS[i]; ctx.beginPath(); ctx.moveTo(800, cy); ctx.arc(800, cy, 120, angle, end); ctx.closePath(); ctx.fill(); angle = end;
      });
      if (content.display === 'donut') { ctx.fillStyle = '#faf7f2'; ctx.beginPath(); ctx.arc(800, cy, 65, 0, Math.PI * 2); ctx.fill(); }
      y += 290;
    }
    for (const [i, row] of counts.entries()) {
      ctx.font = '26px "Malgun Gothic", sans-serif';
      const percent = total ? Math.round(row.count / total * 100) : 0;
      for (const line of lines(`${row.label} — ${row.count}표 (${percent}%)`, 1400)) {
        if (y > 755) { await save(); start(); ctx.font = '26px "Malgun Gothic", sans-serif'; }
        ctx.fillStyle = SURVEY_COLORS[i]; ctx.fillText(line, 65, y); y += 35;
      }
      if (content.display === 'bar') { ctx.fillStyle = '#e2e0dc'; ctx.fillRect(65, y, 1400, 18); ctx.fillStyle = SURVEY_COLORS[i]; ctx.fillRect(65, y, 1400 * percent / 100, 18); y += 25; }
      y += 12;
    }
    if (y > 790) { await save(); start(); }
    ctx.fillStyle = '#777777'; ctx.font = '22px "Malgun Gothic", sans-serif';
    ctx.fillText(content.multiple ? '복수 선택 · 비율은 전체 선택 수 기준' : '비율은 전체 응답 수 기준', 65, y);
  }
  if (!rows.length) { ctx.fillStyle = '#777777'; ctx.fillText('아직 응답이 없습니다.', 65, y + 35); }
  await save(); return pages;
}
