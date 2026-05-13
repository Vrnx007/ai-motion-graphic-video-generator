import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { clientIpFromRequest, rateLimitHit } from "@/lib/rate-limit";
import { signRenderWebhookBody } from "@/lib/render-webhook-sign";

/**
 * Headless Remotion render is not available on Vercel serverless (no Chromium).
 *
 * Optional: set REMOTION_RENDER_WEBHOOK_URL to a worker (Lambda, Modal, Fly, etc.)
 * that accepts POST JSON `{ videoCode, duration, aspectRatio, ... }` and returns
 * `{ downloadUrl: string }` or a binary video body.
 *
 * When REMOTION_RENDER_WEBHOOK_SECRET is set, requests include `X-Motion-Signature: hex(sha256Hmac(secret, rawBody))`.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  const rl = rateLimitHit(`render-video:${ip}`, 40, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const webhook = process.env.REMOTION_RENDER_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.REMOTION_RENDER_WEBHOOK_SECRET?.trim();

  if (webhook) {
    try {
      const rawBody = await req.text();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (webhookSecret) {
        headers["X-Motion-Signature"] = signRenderWebhookBody(webhookSecret, rawBody);
      }
      const res = await fetch(webhook, {
        method: "POST",
        headers,
        body: rawBody,
      });
      const text = await res.text();
      if (!res.ok) {
        return NextResponse.json(
          { error: text || `Render worker returned ${res.status}` },
          { status: 502 }
        );
      }
      try {
        const json = JSON.parse(text);
        if (json.downloadUrl) {
          return NextResponse.json({ downloadUrl: json.downloadUrl, mode: "worker" });
        }
      } catch {
        /* fall through if not JSON */
      }
      return new NextResponse(text, {
        status: 200,
        headers: { "Content-Type": res.headers.get("content-type") || "video/mp4" },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Render webhook failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  return NextResponse.json(
    {
      mode: "client",
      error:
        "Server-side Remotion render is not configured. Export uses in-browser recording (WebM). " +
        "Set REMOTION_RENDER_WEBHOOK_URL to your Remotion Lambda / worker URL for MP4 pipeline.",
    },
    { status: 501 }
  );
}
