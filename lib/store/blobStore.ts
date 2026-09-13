// 바이너리 저장소 (IndexedDB).
// localStorage는 5MB 남짓이라 PDF/이미지를 담을 수 없다. 파일 바이트는 전부 여기에 둔다.
// 메타데이터(제목/작성자 등)는 localStorage, 실제 바이트는 IndexedDB — 이렇게 나눠 저장한다.
//
// Supabase 전환 시 이 파일이 Storage 업로드/다운로드로 대체된다.

const DB_NAME = "classflow";
const DB_VERSION = 2;

export type BlobStoreName = "pdfs" | "images";

const STORES: BlobStoreName[] = ["pdfs", "images"];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(
  store: BlobStoreName,
  key: string,
  data: Blob | ArrayBuffer,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBlob<T = Blob | ArrayBuffer>(
  store: BlobStoreName,
  key: string,
): Promise<T | null> {
  const db = await openDb();
  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteBlob(store: BlobStoreName, key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
