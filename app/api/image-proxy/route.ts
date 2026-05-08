import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Image Proxy — fetches remote images server-side to bypass CORS restrictions.
 * Usage: /api/image-proxy?url=https://example.com/image.png
 * 
 * This is critical because Remotion's <Img> component runs in the browser,
 * and most websites block cross-origin image fetches. By proxying through
 * our own server, we bypass CORS entirely.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
    }

    // Validate it's a real URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }

    // Fetch the image server-side (no CORS issues)
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[image-proxy] Error:", error.message);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
