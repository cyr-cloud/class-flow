// PDF 바이트 저장소.
// 실제 IndexedDB 접근은 lib/store/blobStore.ts가 담당한다 (이미지 저장소와 DB 버전을 공유해야 하므로).
// 강사가 올린 PDF를 학생 탭(같은 브라우저)도 pdfKey로 읽어간다.

import { getBlob, putBlob } from "../store/blobStore";

export async function savePdf(key: string, data: ArrayBuffer): Promise<void> {
  await putBlob("pdfs", key, data);
}

export async function loadPdf(key: string): Promise<ArrayBuffer | null> {
  if (key.startsWith("/samples/")) {
    const res = await fetch(key);
    return res.ok ? res.arrayBuffer() : null;
  }
  return getBlob<ArrayBuffer>("pdfs", key);
}
