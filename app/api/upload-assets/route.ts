import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

// POST: Upload images (base64) and store references
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { images, brandKitId } = await req.json();
    // images: Array<{ data: string (base64), name: string, type: string }>

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // Save images to public/uploads directory
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });

    const savedImages: Array<{ url: string; alt: string; context: string }> = [];

    for (const img of images.slice(0, 20)) { // Max 20 images
      const ext = img.name?.split(".").pop() || "png";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filepath = path.join(uploadDir, filename);

      // Strip base64 header if present
      const base64Data = img.data.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));

      savedImages.push({
        url: `/uploads/${filename}`,
        alt: img.name || "Uploaded image",
        context: "uploaded",
      });
    }

    // If brandKitId provided, append images to the brand kit
    if (brandKitId) {
      const kit = await db.brandKit.findUnique({ where: { id: brandKitId } });
      if (kit && kit.userId === session.user.id) {
        const existingImages = (kit.images as any[]) || [];
        await db.brandKit.update({
          where: { id: brandKitId },
          data: { images: [...existingImages, ...savedImages] },
        });
      }
    }

    return NextResponse.json({ images: savedImages });
  } catch (error: any) {
    console.error("[upload-assets] Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
