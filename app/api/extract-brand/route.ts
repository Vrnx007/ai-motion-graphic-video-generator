import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth";
import { extractFromUrl } from "@/lib/brand-extractor";
import { captureBrandPage } from "@/lib/brand/playwright";
import { db } from "@/lib/prisma";
import { logApiError } from "@/lib/server-log";

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

    // Run the extraction pipeline
    let brandData = await extractFromUrl(parsedUrl.href);

    if (process.env.USE_PLAYWRIGHT_BRAND === "true") {
      const snap = await captureBrandPage(parsedUrl.href);
      if (snap?.h1Font || snap?.bodyFont) {
        const pick = (s: string | null) =>
          s
            ?.split(",")[0]
            ?.replace(/["']/g, "")
            ?.trim() || undefined;
        brandData = {
          ...brandData,
          fonts: {
            heading: pick(snap.h1Font) || brandData.fonts.heading,
            body: pick(snap.bodyFont) || brandData.fonts.body,
          },
        };
      }
    }

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
        testimonials: brandData.testimonials as Prisma.InputJsonValue,
        integrations: brandData.integrations as Prisma.InputJsonValue,
        pricingCues: brandData.pricingCues as Prisma.InputJsonValue,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ id: brandKit.id, ...brandData });
  } catch (error: unknown) {
    logApiError("extract-brand", error);
    const message = error instanceof Error ? error.message : "Brand extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
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
