import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth";
import { extractFromUrl } from "@/lib/brand-extractor";
import { db } from "@/lib/prisma";
import { logApiError } from "@/lib/server-log";

export const maxDuration = 60;

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let url: string;
    try {
      const body = (await req.json()) as { url?: unknown };
      if (!body?.url || typeof body.url !== "string") {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      url = body.url.trim();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    let brandData: Awaited<ReturnType<typeof extractFromUrl>>;
    try {
      brandData = await extractFromUrl(parsedUrl.href);
    } catch (e: unknown) {
      logApiError("extract-brand/pipeline", e);
      const message = e instanceof Error ? e.message : "Brand extraction failed";
      const userRecoverable =
        /fail(ed)? to fetch|ECONN|ETIMEDOUT|aborted|fetch failed|network|timed out|403|404/i.test(
          message
        );
      return NextResponse.json({ error: message }, { status: userRecoverable ? 422 : 500 });
    }

    if (process.env.USE_PLAYWRIGHT_BRAND === "true") {
      try {
        const { captureBrandPage } = await import("@/lib/brand/playwright");
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
      } catch (e) {
        console.warn("[extract-brand] Playwright enhance skipped:", e);
      }
    }

    try {
      const brandKit = await db.brandKit.create({
        data: {
          name: brandData.headline || parsedUrl.hostname,
          sourceUrl: parsedUrl.href,
          logoUrl: brandData.logoUrl,
          colors: brandData.colors as Prisma.InputJsonValue,
          brandPalette: brandData.brandPalette as Prisma.InputJsonValue,
          fonts: brandData.fonts as Prisma.InputJsonValue,
          headline: brandData.headline,
          subheadline: brandData.subheadline,
          features: brandData.features as Prisma.InputJsonValue,
          cta: brandData.cta,
          tone: brandData.tone,
          style: brandData.style,
          images: brandData.images as Prisma.InputJsonValue,
          testimonials: JSON.parse(JSON.stringify(brandData.testimonials)) as Prisma.InputJsonValue,
          integrations: JSON.parse(JSON.stringify(brandData.integrations)) as Prisma.InputJsonValue,
          pricingCues: JSON.parse(JSON.stringify(brandData.pricingCues)) as Prisma.InputJsonValue,
          userId: session.user.id,
        },
      });

      return NextResponse.json({ id: brandKit.id, ...brandData });
    } catch (e: unknown) {
      logApiError("extract-brand/db", e);
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json(
          {
            error:
              "Could not save brand kit. Confirm DATABASE_URL is set and Prisma migrations ran (brand_kit table).",
            code: e.code,
          },
          { status: 503 }
        );
      }
      if (
        e !== null &&
        typeof e === "object" &&
        (e as { name?: string }).name === "PrismaClientInitializationError"
      ) {
        return NextResponse.json(
          { error: "Database is not configured or unreachable (check DATABASE_URL)." },
          { status: 503 }
        );
      }
      const message = e instanceof Error ? e.message : "Database error";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  } catch (error: unknown) {
    logApiError("extract-brand", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
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
