import { del, head } from "@vercel/blob";
import { ConversionQueue } from "./queue";

/** Preserve completed lessons and originals. Only expired failed uploads are removed. */
export async function reconcileConversionStorage(queue: ConversionQueue) {
  const jobs = await queue.maintenanceJobs();
  await Promise.all(jobs.map(async job => {
    try {
      if (job.status === "failed") {
        // Upload/worker tokens expire within 15 minutes. Wait an hour before cleanup.
        // Failed jobs never publish a PDF URL to a lesson.
        await del([job.sourcePath, job.pdfPath]);
        await queue.recordStoredBytes(job.id, "failed", 0);
      } else if (job.status === "done") {
        const [source, pdf] = await Promise.all([head(job.sourcePath), head(job.pdfPath)]);
        await queue.recordStoredBytes(job.id, "done", source.size + pdf.size);
      }
    } catch {
      // Storage failures must not release reserved capacity or block other repairs.
      console.warn("Conversion storage reconciliation deferred", job.id);
    }
  }));
}
