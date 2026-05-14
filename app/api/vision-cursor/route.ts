import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

/**
 * Vision-LLM cursor targeting — stub returns a plausible DemoBrowserWalkthrough path.
 * Wire Gemini/OpenAI with image input in production.
 */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = (await req.json().catch(() => null)) as { imageUrl?: string } | null;
  const imageUrl = typeof json?.imageUrl === "string" ? json.imageUrl : undefined;
  const keyframes = [
    { frame: 0, xRatio: 0.22, yRatio: 0.35 },
    { frame: 45, xRatio: 0.55, yRatio: 0.42 },
    { frame: 95, xRatio: 0.48, yRatio: 0.58 },
    { frame: 140, xRatio: 0.36, yRatio: 0.5 },
  ];
  return NextResponse.json({ keyframes, source: "stub", imageUrl: imageUrl ?? null });
}
