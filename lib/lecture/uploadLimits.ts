/** Direct PDF uploads go to Blob via multipart upload, not through a Vercel request body. */
export const PDF_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
export const PDF_UPLOAD_SIZE_ERROR = "200MB 이하 PDF를 선택해 주세요.";
