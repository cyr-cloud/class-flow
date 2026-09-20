import type { LabPost } from "../types";

/** 브라우저의 PDF 저장을 사용해 한글과 이미지를 원본 해상도로 인쇄한다. */
export async function printSubmissions(title: string, posts: LabPost[]) {
  const submitted = posts.filter(p => p.createdAt !== 0)
    .sort((a, b) => a.authorName.localeCompare(b.authorName, "ko") || a.createdAt - b.createdAt);
  if (!submitted.length) throw new Error("아직 학생 제출물이 없어요.");
  const previous = document.getElementById("submission-print-preview");
  previous?.remove();
  const overlay = document.createElement("div");
  overlay.id = "submission-print-preview";
  overlay.style.cssText = "position:fixed;inset:0;z-index:100;background:white;display:flex;flex-direction:column";
  const close = document.createElement("button");
  close.textContent = "← 갤러리로 돌아가기";
  close.style.cssText = "padding:16px;background:#252525;color:white;text-align:left;cursor:pointer";
  close.onclick = () => overlay.remove();
  const frame = document.createElement("iframe");
  frame.title = "제출물 PDF 미리보기";
  frame.style.cssText = "flex:1;width:100%;border:0;background:white";
  overlay.append(close, frame);
  document.body.append(overlay);
  const popup = frame.contentWindow!;
  const doc = frame.contentDocument!;
  doc.title = `${title} - 제출물`;
  doc.documentElement.lang = "ko";
  const style = doc.createElement("style");
  style.textContent = `
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, 'Malgun Gothic', sans-serif; color: #252525; margin: 24px auto; max-width: 178mm; }
    h1 { font-size: 22px; overflow-wrap: anywhere; } h2 { font-size: 20px; }
    .meta { color: #666; font-size: 12px; } p { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
    article { break-before: page; padding-top: 8mm; }
    article:first-of-type { break-before: auto; }
    img { display: block; width: 100%; max-height: 155mm; object-fit: contain; margin: 16px 0; break-inside: avoid; }
    button { padding: 10px 18px; cursor: pointer; }
    @media print { body { margin: 0; } .controls { display: none; } h2 { break-after: avoid; } }
  `;
  doc.head.append(style);
  const add = (parent: HTMLElement, tag: string, text: string, className = "") => {
    const element = doc.createElement(tag);
    element.textContent = text;
    element.className = className;
    parent.append(element);
    return element;
  };
  const controls = add(doc.body, "div", "", "controls");
  add(controls, "p", "인쇄 창에서 대상을 ‘PDF로 저장’으로 선택하세요. 강사 예시는 제외됩니다.");
  const button = add(controls, "button", "이미지 준비 중…") as HTMLButtonElement;
  button.disabled = true;
  button.onclick = () => popup.print();
  add(doc.body, "h1", title);
  add(doc.body, "p", `제출물 ${submitted.length}개 · 이름순 · ${new Date().toLocaleDateString("ko-KR")}`, "meta");
  const images: Promise<void>[] = [];
  for (const [index, post] of submitted.entries()) {
    const article = add(doc.body, "article", "");
    add(article, "h2", `${index + 1}. ${post.authorName.trim() || "이름 없음"}`);
    add(article, "p", new Date(post.createdAt).toLocaleString("ko-KR"), "meta");
    add(article, "p", post.description || "설명 없음");
    if (post.imageUrl) {
      const img = doc.createElement("img");
      img.alt = `${post.authorName || "학생"} 제출 이미지`;
      images.push(new Promise<void>(resolve => {
        const timer = window.setTimeout(() => { img.remove(); add(article, "p", "이미지를 불러오지 못했습니다. 다시 저장해 주세요."); resolve(); }, 15000);
        img.onload = () => { clearTimeout(timer); resolve(); };
        img.onerror = () => { clearTimeout(timer); img.remove(); add(article, "p", "이미지를 불러오지 못했습니다. 다시 저장해 주세요."); resolve(); };
      }));
      img.src = new URL(post.imageUrl, window.location.origin).href;
      article.append(img);
    }
  }
  await Promise.all(images);
  if (!frame.isConnected) return;
  await doc.fonts.ready;
  button.disabled = false;
  button.textContent = "PDF로 저장 / 인쇄";
  popup.focus();
}
