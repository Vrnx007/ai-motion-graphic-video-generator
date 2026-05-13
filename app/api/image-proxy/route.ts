import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { clientIpFromRequest, rateLimitHit } from "@/lib/rate-limit";
import { IMAGE_PROXY_MAX_BYTES, isUrlSafeForServerFetch } from "@/lib/url-safety";

export const maxDuration = 30;

/**
 * Image proxy — fetches remote images server-side.
 * - Authenticated users: any safe URL (for studio / owner preview).
 * - Public: pass `shareToken` matching a project (same token as in /share/[shareToken]) so share viewers can load images without login.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");
    const shareToken = searchParams.get("shareToken")?.trim();

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    const session = await getServerSession();
    let authorized = !!session?.user;

    if (!authorized && shareToken && shareToken.length <= 128) {
      const project = await db.project.findUnique({
        where: { shareToken },
        select: { id: true },
      });
      authorized = !!project;
      if (authorized) {
        const rl = rateLimitHit(`image-proxy-share:${shareToken}`, 400, 60 * 60 * 1000);
        if (!rl.allowed) {
          return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
          );
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = clientIpFromRequest(req);
    const rl = rateLimitHit(`image-proxy:${ip}`, 200, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const safe = isUrlSafeForServerFetch(imageUrl);
    if (!safe.ok) {
      return NextResponse.json({ error: safe.reason }, { status: 400 });
    }

    const response = await fetch(safe.url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: 502 });
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > IMAGE_PROXY_MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const ctLower = contentType.toLowerCase();
    if (!ctLower.startsWith("image/") && !ctLower.includes("octet-stream")) {
      return NextResponse.json({ error: "Not an image response" }, { status: 400 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > IMAGE_PROXY_MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
