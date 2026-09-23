import { put } from "@vercel/blob/client";

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) => Uint8Array.from(value.match(/.{2}/g) ?? [], b => parseInt(b, 16));
const headers = (sessionId: string) => ({ "x-teacher-token": localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "" });
async function read(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "PPT 변환 서버에 연결하지 못했어요.");
  return body;
}
export async function convertSharedPpt(sessionId: string, file: File, progress: (message: string) => void) {
  if (!file.size || file.size > 200 * 1024 * 1024) throw new Error("200MB 이하 PPTX를 선택해 주세요.");
  progress("PPT 원본을 암호화하고 있어요. AI는 실행하지 않습니다.");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, await file.arrayBuffer());
  const url = `/api/conversions?sessionId=${encodeURIComponent(sessionId)}`;
  const post = (body: object) => fetch(url, { method: "POST", headers: { ...headers(sessionId), "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(read);
  const job = await post({ action: "prepare", name: file.name, key: hex(key), iv: hex(iv), inputBytes: encrypted.byteLength });
  try {
    await put(job.pathname, new Blob([encrypted], { type: "application/octet-stream" }), {
    token: job.token, access: "public", contentType: "application/octet-stream", multipart: true,
    onUploadProgress: ({ percentage }) => progress(`PPT 업로드 중… ${Math.round(percentage)}%`),
    });
    await post({ action: "submit", id: job.id });
  } catch (error) {
    await post({ action: "cancel", id: job.id }).catch(() => {});
    throw error;
  }
  // Preserve the job ID so a refresh doesn't require uploading the file again.
  localStorage.setItem(`classflow:conversion:${sessionId}`, job.id);
  return waitForConversion(sessionId, job.id, progress);
}
export async function waitForConversion(sessionId: string, id: string, progress: (message: string) => void) {
  for (let i = 0; i < 450; i++) {
    const job = await fetch(`/api/conversions?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(id)}`, { headers: headers(sessionId), cache: "no-store" }).then(read);
    if (job.status === "done") return { url: job.pdfUrl as string, name: job.name as string };
    if (job.status === "failed") { localStorage.removeItem(`classflow:conversion:${sessionId}`); throw new Error(job.error); }
    progress(job.status === "converting" ? "PPT를 PDF로 변환 중이에요. 보통 수십 초, 큰 자료는 최대 3분 정도 걸려요." : "변환 차례를 기다리고 있어요…");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("변환 확인이 지연되고 있어요. 잠시 후 ‘변환 결과 확인’을 눌러 주세요.");
}
export async function originalSharedPpt(sessionId: string) {
  const job = await fetch(`/api/conversions?sessionId=${encodeURIComponent(sessionId)}&material=1`, { headers: headers(sessionId), cache: "no-store" }).then(read);
  const response = await fetch(job.sourceUrl);
  if (!response.ok) throw new Error("PPT 원본을 불러오지 못했어요.");
  const key = await crypto.subtle.importKey("raw", unhex(job.key), "AES-GCM", false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: unhex(job.iv) }, key, await response.arrayBuffer());
}
