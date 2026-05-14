import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { clientIpFromRequest, rateLimitHitAsync } from "@/lib/rate-limit";
import { enqueueRenderJob } from "@/lib/render-queue";
import { processRenderJob } from "@/lib/render/process-job";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

/**
 * Enqueue Remotion render (BullMQ when REDIS_URL set) and process in background when Redis absent.
 * Legacy synchronous webhook path removed — use RenderJob + status SSE.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  const rl = await rateLimitHitAsync(`render-video:${ip}`, 40, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const render4K = Boolean(body.render4K);
  const stemsRequested = Boolean(body.stemsRequested);

  const job = await db.renderJob.create({
    data: {
      userId: session.user.id,
      projectId,
      status: "queued",
      renderInput: body as Prisma.InputJsonValue,
      render4K,
      stemsRequested,
      costCents: 0,
    },
  });

  const queued = await enqueueRenderJob(job.id);
  if (!queued) {
    void processRenderJob(job.id).catch((e) => logger.error({ err: e, jobId: job.id }, "inline render failed"));
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    queue: queued ? "bullmq" : "inline",
  });
}
