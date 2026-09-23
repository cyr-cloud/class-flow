import { randomUUID } from "node:crypto";
import { kv, type Kv } from "../live/storage";

export interface ConversionJob {
  id: string; sessionId: string; name: string; createdAt: number; inputBytes: number;
  status: "uploading" | "queued" | "converting" | "done" | "failed";
  sourcePath: string; pdfPath: string; sourceUrl?: string; pdfUrl?: string;
  key: string; iv: string; lease?: string; leaseUntil?: number; error?: string;
}
interface Queue { jobs: ConversionJob[]; day: string; attempts: number }
const QUEUE_KEY = "conversion:queue:v1";
export const INPUT_LIMIT = 200 * 1024 * 1024 + 16;
export const OUTPUT_LIMIT = 60 * 1024 * 1024;

/** One CAS-protected queue for a single converter; small metadata only, never PPT bytes. */
export class ConversionQueue {
  constructor(private storage: Kv = kv(), private now = () => Date.now()) {}
  private async change<T>(fn: (q: Queue, now: number) => T): Promise<T> {
    for (let i = 0; i < 12; i++) {
      const raw = await this.storage.get(QUEUE_KEY);
      const now = this.now();
      const day = new Date(now).toISOString().slice(0, 10);
      const q: Queue = raw ? JSON.parse(raw) : { jobs: [], day, attempts: 0 };
      if (q.day !== day) { q.day = day; q.attempts = 0; }
      for (const job of q.jobs) {
        if (job.status === "converting" && (job.leaseUntil ?? 0) < now ||
          ["uploading", "queued"].includes(job.status) && job.createdAt + 20 * 60_000 < now) {
          job.status = "failed"; job.error = "변환 대기 시간이 초과됐어요. 다시 업로드해 주세요.";
        }
      }
      const result = fn(q, now);
      const next = JSON.stringify(q);
      if (raw === next || await this.storage.compareAndSet(QUEUE_KEY, raw, next)) return result;
    }
    throw new Error("요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.");
  }
  async prepare(sessionId: string, name: string, key: string, iv: string, inputBytes = INPUT_LIMIT) {
    return this.change((q, now) => {
      if (q.jobs.some(j => j.sessionId === sessionId && !["done", "failed"].includes(j.status))) throw new Error("이 수업의 PPT를 이미 처리 중이에요.");
      if (q.attempts >= 20) throw new Error("오늘의 PPT 변환 한도에 도달했어요. PDF 업로드는 계속 사용할 수 있어요.");
      if (!Number.isInteger(inputBytes) || inputBytes <= 16 || inputBytes > INPUT_LIMIT) throw new Error("PPT 파일 크기를 확인해 주세요.");
      if (q.jobs.reduce((sum, j) => sum + (j.inputBytes ?? INPUT_LIMIT) + OUTPUT_LIMIT, 0) + inputBytes + OUTPUT_LIMIT > 512 * 1024 * 1024)
        throw new Error("PPT 변환 자료의 시험 운영 보관 한도에 도달했어요. 관리자에게 문의해 주세요.");
      if (q.jobs.filter(j => !["done", "failed"].includes(j.status)).length >= 5) throw new Error("변환 대기열이 가득 찼어요. 잠시 후 다시 시도해 주세요.");
      // Completed jobs remain available for original downloads. Explicit capacity, no silent eviction.
      if (q.jobs.length >= 500) throw new Error("변환 자료 보관 한도에 도달했어요. 관리자에게 문의해 주세요.");
      const id = randomUUID();
      const job: ConversionJob = { id, sessionId, name, key, iv, inputBytes, createdAt: now, status: "uploading", sourcePath: `ppt-sources/${id}.bin`, pdfPath: `decks/${sessionId}/${id}.pdf` };
      q.jobs.push(job); q.attempts++;
      return job;
    });
  }
  async get(id: string) { return this.change(q => q.jobs.find(j => j.id === id) ?? null); }
  async material(sessionId: string, pdfUrl: string) { return this.change(q => q.jobs.find(j => j.sessionId === sessionId && j.status === "done" && j.pdfUrl === pdfUrl) ?? null); }
  async enqueue(id: string, sourceUrl: string) {
    return this.change(q => {
      const job = q.jobs.find(j => j.id === id);
      if (!job) throw new Error("변환 작업을 찾지 못했어요.");
      if (job.status === "uploading") { job.sourceUrl = sourceUrl; job.status = "queued"; }
      return job;
    });
  }
  async cancelUpload(id: string) {
    return this.change(q => {
      const job = q.jobs.find(j => j.id === id);
      if (job?.status === "uploading") { job.status = "failed"; job.error = "PPT 업로드가 중단됐어요. 다시 시도해 주세요."; }
      return job;
    });
  }
  async claim() {
    return this.change((q, now) => {
      if (q.jobs.some(j => j.status === "converting")) return null;
      const job = q.jobs.find(j => j.status === "queued");
      if (!job) return null;
      job.status = "converting"; job.lease = randomUUID(); job.leaseUntil = now + 10 * 60_000;
      return job;
    });
  }
  async complete(id: string, lease: string, result: { pdfUrl: string } | { error: string }) {
    return this.change(q => {
      const job = q.jobs.find(j => j.id === id);
      if (!job || job.lease !== lease) throw new Error("잘못된 변환 작업입니다.");
      if (job.status === "done" || job.status === "failed") return job;
      if (job.status !== "converting") throw new Error("진행 중인 변환이 아닙니다.");
      if ("error" in result) { job.status = "failed"; job.error = result.error; }
      else { job.status = "done"; job.pdfUrl = result.pdfUrl; }
      return job;
    });
  }
}

export function conversionEnabled() {
  return process.env.PPT_CONVERSION_ENABLED === "1" && !!process.env.CONVERSION_WORKER_SECRET && !!process.env.BLOB_READ_WRITE_TOKEN;
}
export function publicJob(job: ConversionJob) {
  return { id: job.id, name: job.name, status: job.status, pdfUrl: job.pdfUrl, error: job.error };
}
