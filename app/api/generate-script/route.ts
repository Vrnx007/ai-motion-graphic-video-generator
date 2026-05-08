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
  templateName?: string;
}

export interface ScenePlan {
  scenes: Scene[];
  totalDuration: number;
  musicMood: string;
}

// Calculate how many scenes we need for a given duration
function getSceneCount(duration: number): number {
  if (duration <= 15) return 3;
  if (duration <= 30) return 5;
  if (duration <= 60) return 8;
  if (duration <= 120) return 12;
  if (duration <= 180) return 16;
  return Math.ceil(duration / 12); // ~12s per scene for long videos
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, videoType, duration, brandKit } = await req.json();
    const targetDuration = Math.max(Number(duration) || 30, 5);
    const sceneCount = getSceneCount(targetDuration);

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
  Available Images from website (DISTRIBUTE THESE across scenes):
${images.map((img: any, i: number) => `    Image ${i + 1}: ${img.url} (${img.alt || img.context})`).join("\n")}
`;
    }

    const systemPrompt = `You are a professional video scriptwriter and creative director.

Your task is to generate a SCENE PLAN for a ${videoType || "general"} video.

${brandContext}

USER REQUEST: ${prompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL DURATION REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TARGET DURATION: EXACTLY ${targetDuration} seconds
REQUIRED NUMBER OF SCENES: EXACTLY ${sceneCount} scenes
AVERAGE DURATION PER SCENE: ${Math.round(targetDuration / sceneCount)} seconds

THE SUM OF ALL SCENE DURATIONS MUST EQUAL EXACTLY ${targetDuration} SECONDS.
DO NOT generate fewer scenes. DO NOT make scenes shorter than needed.

VIDEO TYPE TEMPLATES:
- "product-launch": Hook → Problem → Solution → Demo → Features × 2-3 → Social Proof → Benefits → CTA → Outro
- "feature-explainer": Hook → Context → Feature 1 → Feature 2 → Feature 3 → Benefits → Demo → CTA → Outro
- "website-hero": Brand Intro → Value Prop → Key Visual → Features → Demo → Social Proof → CTA → Outro
- "ad-creative": Hook → Problem → Agitation → Solution → Demo → Proof → CTA
- "social-teaser": Hook → Quick Demo → Feature Flash × 3 → CTA
- "general": Hook → Main Content × 2-3 → Supporting Points × 2-3 → Visual Break → CTA → Outro

AVAILABLE TEMPLATES (assign one to each scene via "templateName"):
- "KineticHero" — Bold typography with staggered word reveals. Best for: hook, intro, CTA, headlines.
- "BentoGrid" — Apple-style grid layout showcasing 3 features. Best for: features, demo, solution.
- "FeatureShowcase" — Full-screen image with animated text overlay. Best for: demo, solution, social-proof.
- "SplitScreen" — Left text / right image layout with slide-in. Best for: problem, solution, features.
- "StatCounter" — Animated number counters with labels. Best for: social-proof, benefits.
- "LogoReveal" — Cinematic logo entrance with particles. Best for: intro, outro, CTA.

RULES:
1. Output ONLY valid JSON — no markdown, no explanation
2. Each scene must have: id (number), type (string), duration (seconds), title (short label), text (the on-screen copy), visual (description), templateName (one of the available templates above)
3. DISTRIBUTE brand images across scenes — every scene with a visual element should have an imageUrl
4. Use the brand's ACTUAL headlines, features, and CTA text — DO NOT make up generic copy
5. THE SUM OF ALL SCENE DURATIONS MUST EQUAL EXACTLY ${targetDuration} SECONDS
6. You MUST generate EXACTLY ${sceneCount} scenes
7. Choose a musicMood from: upbeat, cinematic, energetic, chill, dramatic, tech, luxury

OUTPUT FORMAT:
{
  "scenes": [
    { "id": 1, "type": "hook", "duration": ${Math.round(targetDuration / sceneCount)}, "title": "...", "text": "...", "visual": "...", "imageUrl": "...", "templateName": "KineticHero" },
    { "id": 2, "type": "problem", "duration": ${Math.round(targetDuration / sceneCount)}, "title": "...", "text": "...", "visual": "...", "imageUrl": "...", "templateName": "SplitScreen" },
    ...${sceneCount} scenes total...
  ],
  "totalDuration": ${targetDuration},
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

    // POST-PROCESS: Force total duration to match target
    const actualTotal = scenePlan.scenes.reduce((s, sc) => s + sc.duration, 0);
    if (actualTotal !== targetDuration) {
      // Redistribute durations proportionally
      const ratio = targetDuration / actualTotal;
      let running = 0;
      scenePlan.scenes.forEach((sc, i) => {
        if (i === scenePlan.scenes.length - 1) {
          sc.duration = targetDuration - running; // last scene gets remainder
        } else {
          sc.duration = Math.max(3, Math.round(sc.duration * ratio));
          running += sc.duration;
        }
      });
    }

    scenePlan.totalDuration = targetDuration;

    return NextResponse.json(scenePlan);
  } catch (error: any) {
    console.error("[generate-script] Error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed" },
      { status: 500 }
    );
  }
}
