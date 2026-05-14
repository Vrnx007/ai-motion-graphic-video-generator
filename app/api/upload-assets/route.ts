import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { isR2Configured, putObjectPublic } from "@/lib/r2";

export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** POST: upload images (base64). Stored on Cloudflare R2 when configured, else local public/uploads (dev fallback). */
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { images, brandKitId } = await req.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const savedImages: Array<{ url: string; alt: string; context: string }> = [];
    const useR2 = isR2Configured();

    for (const img of images.slice(0, MAX_FILES)) {
      const base64Data = String(img.data || "").replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(base64Data, "base64");
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: "Invalid or oversized image payload" }, { status: 400 });
      }

      const { fileTypeFromBuffer } = await import("file-type");
      const detected = await fileTypeFromBuffer(buf);
      const mime = detected?.mime;
      if (!mime || !ALLOWED_MIME.has(mime)) {
        return NextResponse.json(
          { error: "Only JPEG, PNG, GIF, or WebP uploads are allowed (magic-byte verified)." },
          { status: 400 }
        );
      }

      const ext =
        mime === "image/jpeg"
          ? "jpg"
          : mime === "image/png"
            ? "png"
            : mime === "image/gif"
              ? "gif"
              : "webp";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

      let publicUrl: string;
      if (useR2) {
        const key = `uploads/${session.user.id}/${filename}`;
        publicUrl = await putObjectPublic(key, buf, mime);
      } else {
        const fs = await import("fs");
        const path = await import("path");
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        fs.mkdirSync(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, buf);
        publicUrl = `/uploads/${filename}`;
      }

      savedImages.push({
        url: publicUrl,
        alt: img.name || "Uploaded image",
        context: "uploaded",
      });
    }

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

    return NextResponse.json({ images: savedImages, storage: useR2 ? "r2" : "local" });
  } catch (error: any) {
    console.error("[upload-assets] Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
