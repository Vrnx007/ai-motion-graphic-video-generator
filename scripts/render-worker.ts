/**
 * BullMQ worker — run beside Next.js (Fly, Railway, etc.): `npm run worker:render`
 */
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processRenderJob } from "../lib/render/process-job";

const url = process.env.REDIS_URL?.trim() || process.env.BULLMQ_REDIS_URL?.trim();
if (!url) {
  console.error("REDIS_URL (or BULLMQ_REDIS_URL) is required");
  process.exit(1);
}

const connection = new IORedis(url, { maxRetriesPerRequest: null });

const worker = new Worker<{ jobId: string }>(
  "motion-render",
  async (job) => {
    const id = job.data?.jobId;
    if (!id) return;
    await processRenderJob(id);
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error("[render-worker] job failed", job?.id, err);
});

console.log("[render-worker] listening on queue motion-render");
