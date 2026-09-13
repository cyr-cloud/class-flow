// 업로드 이미지 전처리.
// 원본 그대로 저장하면 스마트폰 사진 한 장이 5~10MB라 브라우저 저장소가 금방 찬다.
// 긴 변 기준으로 축소하고 webp/jpeg로 다시 인코딩해서 100~300KB 수준으로 줄인다.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 원본 20MB 초과는 거부

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    img.src = url;
  });
}

/** 이미지를 축소·재인코딩한 Blob으로 변환. 실패하면 원본 File을 그대로 돌려준다. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("20MB 이하 이미지만 올릴 수 있습니다.");
  // GIF는 애니메이션이 날아가므로 건드리지 않는다.
  if (file.type === "image/gif") return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    // 재인코딩이 실패했거나 오히려 커졌으면 원본 사용
    if (!blob || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}
