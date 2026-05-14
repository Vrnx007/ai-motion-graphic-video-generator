import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "@/lib/logger";

let renderQueue: Queue | null = null;

function getConnection(): IORedis | null {
  const url = process.env.REDIS_URL?.trim() || process.env.BULLMQ_REDIS_URL?.trim();
  if (!url) return null;
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function getRenderQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!renderQueue) {
    renderQueue = new Queue("motion-render", { connection: conn });
  }
  return renderQueue;
}

export async function enqueueRenderJob(jobId: string): Promise<boolean> {
  try {
    const q = getRenderQueue();
    if (!q) return false;
    await q.add(
      "render",
      { jobId },
      { removeOnComplete: 1000, removeOnFail: 5000, attempts: 2, backoff: { type: "exponential", delay: 5000 } }
    );
    return true;
  } catch (e) {
    logger.error({ err: e }, "enqueueRenderJob failed");
    return false;
  }
}
