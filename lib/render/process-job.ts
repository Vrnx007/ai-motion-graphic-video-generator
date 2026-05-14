import { db } from "@/lib/prisma";
import { signRenderWebhookBody } from "@/lib/render-webhook-sign";
import { logger } from "@/lib/logger";
import { invokeRemotionLambda } from "@/lib/render/lambda";

/** Background render: webhook worker preferred; Lambda hook stub second. */
export async function processRenderJob(jobId: string): Promise<void> {
  const job = await db.renderJob.findUnique({ where: { id: jobId } });
  if (!job?.renderInput) {
    await db.renderJob.update({
      where: { id: jobId },
      data: { status: "failed", error: "Missing renderInput" },
    });
    return;
  }

  await db.renderJob.update({
    where: { id: jobId },
    data: { status: "rendering", progress: 5 },
  });

  const webhook = process.env.REMOTION_RENDER_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.REMOTION_RENDER_WEBHOOK_SECRET?.trim();

  if (webhook) {
    try {
      const rawBody = JSON.stringify(job.renderInput);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (webhookSecret) {
        headers["X-Motion-Signature"] = signRenderWebhookBody(webhookSecret, rawBody);
      }
      const res = await fetch(webhook, { method: "POST", headers, body: rawBody });
      const text = await res.text();
      if (!res.ok) {
        await db.renderJob.update({
          where: { id: jobId },
          data: { status: "failed", error: text.slice(0, 2000) || `Worker ${res.status}` },
        });
        return;
      }
      try {
        const json = JSON.parse(text) as { downloadUrl?: string };
        if (json.downloadUrl) {
          await db.renderJob.update({
            where: { id: jobId },
            data: {
              status: "done",
              progress: 100,
              outputUrl: json.downloadUrl,
              costCents: job.costCents + 50,
              spendBreakdown: { webhookCents: 50 },
            },
          });
          return;
        }
      } catch {
        /* not JSON */
      }
      await db.renderJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: "Worker returned non-JSON or missing downloadUrl",
        },
      });
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "webhook error";
      await db.renderJob.update({
        where: { id: jobId },
        data: { status: "failed", error: msg },
      });
      return;
    }
  }

  const lambda = await invokeRemotionLambda({
    serveUrl: process.env.REMOTION_SERVE_URL || "",
    composition: "Main",
    inputProps: (job.renderInput as Record<string, unknown>) || {},
    codec: "h264",
    crf: job.render4K ? 16 : 18,
    pixelFormat: "yuv420p",
  });
  if (lambda.renderId) {
    await db.renderJob.update({
      where: { id: jobId },
      data: { status: "rendering", progress: 40, directorState: { lambdaRenderId: lambda.renderId } },
    });
    return;
  }

  logger.warn({ jobId, lambda }, "No render worker configured");
  await db.renderJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      error:
        lambda.error ||
        "Configure REMOTION_RENDER_WEBHOOK_URL (worker) or Remotion Lambda envs for MP4 output.",
    },
  });
}
