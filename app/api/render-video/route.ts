import { NextResponse } from "next/server";

/**
 * Headless Remotion render is not available on Vercel serverless (no Chromium).
 *
 * Optional: set REMOTION_RENDER_WEBHOOK_URL to a worker (Lambda, Modal, Fly, etc.)
 * that accepts POST JSON `{ videoCode, duration, aspectRatio, ... }` and returns
 * `{ downloadUrl: string }` or a binary video body.
 */
export async function POST(req: Request) {
  const webhook = process.env.REMOTION_RENDER_WEBHOOK_URL?.trim();

  if (webhook) {
    try {
      const body = await req.json();
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Render webhook failed" },
        { status: 502 }
      );
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
