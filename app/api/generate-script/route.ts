import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface Scene {
  id: number;
  type: "hook" | "problem" | "solution" | "features" | "demo" | "social-proof" | "cta" | "intro" | "outro";
  duration: number;
  title: string;
  text: string;
  visual: string;
  imageUrl?: string;
}

export interface ScenePlan {
  scenes: Scene[];
  totalDuration: number;
  musicMood: string;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, videoType, duration, brandKit } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Build brand context if available
    let brandContext = "";
    if (brandKit) {
      const images = Array.isArray(brandKit.images) ? brandKit.images : [];
      brandContext = `
BRAND CONTEXT:
  Company: ${brandKit.headline || brandKit.name || "Unknown"}
  Tagline: ${brandKit.subheadline || "N/A"}
  Primary Color: ${brandKit.colors?.primary || "#3B82F6"}
  Secondary Color: ${brandKit.colors?.secondary || "#7C3AED"}
  Accent Color: ${brandKit.colors?.accent || "#06B6D4"}
  Color Palette: ${JSON.stringify(brandKit.brandPalette || [])}
  Font: ${brandKit.fonts?.heading || "Inter"}
  Tone: ${brandKit.tone || "professional"}
  Visual Style: ${brandKit.style || "modern"}
  CTA Text: ${brandKit.cta || "Get Started"}
  Features: ${JSON.stringify(brandKit.features || [])}
  Logo URL: ${brandKit.logoUrl || "N/A"}
  Available Images from website (USE THESE in visuals):
${images.map((img: any, i: number) => `    Image ${i + 1}: ${img.url} (${img.alt || img.context})`).join("\n")}
`;
    }

    const systemPrompt = `You are a professional video scriptwriter and creative director.

Your task is to generate a SCENE PLAN for a ${videoType || "general"} video.

${brandContext}

USER REQUEST: ${prompt}
TARGET DURATION: ${duration || 30} seconds

VIDEO TYPE TEMPLATES:
- "product-launch": Hook → Problem → Solution/Demo → Key Features → Social Proof → CTA
- "feature-explainer": Hook → Context → Feature Deep-Dive (2-3 scenes) → Benefits → CTA
- "website-hero": Brand Intro → Value Proposition → Key Visual → CTA
- "ad-creative": Hook (3s) → Problem (5s) → Solution (5s) → CTA (2s)
- "social-teaser": Hook → Quick Demo → CTA
- "general": Hook → Main Content → Supporting Points → CTA

RULES:
1. Output ONLY valid JSON — no markdown, no explanation
2. Each scene must have: id (number), type (string), duration (seconds), title (short label), text (the on-screen copy), visual (description of what the animation should show)
3. If brand images are available, assign specific image URLs to scenes using "imageUrl" field
4. Use the brand's actual headlines, features, and CTA text — DO NOT make up generic copy
5. Total duration must equal approximately ${duration || 30} seconds
6. Choose a musicMood from: upbeat, cinematic, energetic, chill, dramatic, happy, peaceful, tech, jazz, action, romantic, luxury, documentary, comedy, dark

OUTPUT FORMAT:
{
  "scenes": [
    { "id": 1, "type": "hook", "duration": 4, "title": "Hook", "text": "...", "visual": "...", "imageUrl": "..." },
    ...
  ],
  "totalDuration": ${duration || 30},
  "musicMood": "..."
}`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();

    // Clean up Gemini output
    text = text
      .replace(/^```(?:json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    // Parse and validate
    const scenePlan: ScenePlan = JSON.parse(text);

    if (!scenePlan.scenes || !Array.isArray(scenePlan.scenes)) {
      throw new Error("Invalid scene plan: missing scenes array");
    }

    return NextResponse.json(scenePlan);
  } catch (error: any) {
    console.error("[generate-script] Error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed" },
      { status: 500 }
    );
  }
}
