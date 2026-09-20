// PPT 파일에서 슬라이드별 발표자 노트를 꺼낸다.
//
// 강사 대부분은 대본을 발표자 노트에 적어둔다. 슬라이드 본문은 이미지로 깔리는 일이 많아
// PDF에서 글자가 안 나오지만, 노트는 텍스트 그대로 남아 있다 — 퀴즈 문항과 정답을
// 찾아낼 수 있는 자리는 사실상 여기뿐이다.
//
// pptx는 zip이고, 슬라이드와 노트는 관계 파일(.rels)로 이어져 있다.
// notesSlide1.xml이 1쪽이라는 보장이 없어서 관계를 따라가야 한다.

import { unzipSync, strFromU8 } from "fflate";

export interface SlideNote {
  slideNo: number; // 1-based, 발표 순서
  text: string;
}

/** XML 속성 하나 꺼내기 */
function attr(tag: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
}

function read(files: Record<string, Uint8Array>, path: string): string | null {
  const bytes = files[path];
  return bytes ? strFromU8(bytes) : null;
}

/** `ppt/slides/slide3.xml` → `ppt/slides/_rels/slide3.xml.rels` */
function relsPathFor(path: string): string {
  const at = path.lastIndexOf("/");
  return `${path.slice(0, at)}/_rels/${path.slice(at + 1)}.rels`;
}

/** 관계 파일에서 Id → Target 맵 (Target은 같은 폴더 기준 상대경로) */
function relations(xml: string, baseDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of xml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const target = attr(tag, "Target").replace(/^\.\//, "");
    // "../notesSlides/notesSlide1.xml" 같은 상대경로를 정규화한다
    const parts = `${baseDir}/${target}`.split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (part === "..") stack.pop();
      else if (part && part !== ".") stack.push(part);
    }
    out.set(attr(tag, "Id"), stack.join("/"));
  }
  return out;
}

/** 노트 XML에서 사람이 읽는 글자만 이어붙인다 */
function noteText(xml: string): string {
  const text = (xml.match(/<a:t>([^<]*)<\/a:t>/g) ?? [])
    .map((t) => t.slice(5, -6))
    .join(" ")
    // XML 엔티티 되돌리기
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    // PowerPoint가 글자를 잘게 쪼개 담아서 낱말 사이 공백이 들쑥날쑥하다
    .replace(/\s+/g, " ")
    .trim();
  // 슬라이드 번호만 덩그러니 있는 노트는 버린다
  return /^\d*$/.test(text) ? "" : text;
}

/**
 * pptx 바이트 → 슬라이드 순서대로 정렬된 발표자 노트.
 * 노트가 없는 슬라이드는 결과에서 빠진다.
 */
export function extractNotes(pptx: ArrayBuffer): SlideNote[] {
  const files = unzipSync(new Uint8Array(pptx));

  const presentation = read(files, "ppt/presentation.xml");
  const presentationRels = read(files, "ppt/_rels/presentation.xml.rels");
  if (!presentation || !presentationRels) throw new Error("PPT 구조를 읽지 못했어요.");

  const byId = relations(presentationRels, "ppt");
  // 발표 순서는 sldIdLst에 적힌 순서다 (파일 이름 순서가 아니다)
  const slidePaths = (presentation.match(/<p:sldId\b[^>]*>/g) ?? [])
    .map((tag) => byId.get(attr(tag, "r:id")))
    .filter((p): p is string => Boolean(p));

  const notes: SlideNote[] = [];
  slidePaths.forEach((slidePath, index) => {
    const rels = read(files, relsPathFor(slidePath));
    if (!rels) return;

    const notePath = [...relations(rels, slidePath.slice(0, slidePath.lastIndexOf("/"))).entries()]
      .find(([, target]) => target.includes("notesSlide"))?.[1];
    if (!notePath) return;

    const xml = read(files, notePath);
    if (!xml) return;

    const text = noteText(xml);
    if (text) notes.push({ slideNo: index + 1, text });
  });

  return notes;
}
