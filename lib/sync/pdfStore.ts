// 슬라이드 PDF 바이트를 가져오는 곳.
//
// 슬라이드 키(pdfKey)는 세 가지 모습을 한다:
//   https://....blob.vercel-storage.com/...  공유 저장소에 올린 것 (기본)
//   /samples/...                              앱에 들어 있는 샘플 강의
//   <세션>:<uuid>                              이 브라우저에만 있는 것 (공유 저장소가 없을 때)
//
// 앞의 둘은 주소라서 누가 접속하든 같은 화면을 본다. 세 번째는 올린 사람 브라우저에만
// 있어서 학생 화면이 비는데, 공유 저장소를 못 쓰는 로컬 환경을 위한 대비책으로만 남겨둔다.

import { getBlob, putBlob } from "../store/blobStore";

export function isSharedKey(key: string): boolean {
  return /^https?:\/\//.test(key) || key.startsWith("/samples/");
}

export async function savePdf(key: string, data: ArrayBuffer): Promise<void> {
  await putBlob("pdfs", key, data);
}

export async function loadPdf(key: string): Promise<ArrayBuffer | null> {
  if (isSharedKey(key)) {
    const res = await fetch(key);
    return res.ok ? res.arrayBuffer() : null;
  }
  return getBlob<ArrayBuffer>("pdfs", key);
}
