import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { extractFromUrl } from "@/lib/brand-extractor";
import { db } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    console.log(`[extract-brand] Extracting brand from: ${parsedUrl.href}`);

    // Run the extraction pipeline
    const brandData = await extractFromUrl(parsedUrl.href);

    // Save to database
    const brandKit = await db.brandKit.create({
      data: {
        name: brandData.headline || parsedUrl.hostname,
        sourceUrl: parsedUrl.href,
        logoUrl: brandData.logoUrl,
        colors: brandData.colors,
        brandPalette: brandData.brandPalette,
        fonts: brandData.fonts,
        headline: brandData.headline,
        subheadline: brandData.subheadline,
        features: brandData.features,
        cta: brandData.cta,
        tone: brandData.tone,
        style: brandData.style,
        images: brandData.images,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ id: brandKit.id, ...brandData });
  } catch (error: any) {
    console.error("[extract-brand] Error:", error);
    return NextResponse.json(
      { error: error.message || "Brand extraction failed" },
      { status: 500 }
    );
  }
}

// GET: Fetch user's brand kits
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brandKits = await db.brandKit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(brandKits);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch brand kits" }, { status: 500 });
  }
}
