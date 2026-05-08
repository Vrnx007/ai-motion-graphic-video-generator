import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODEL_CHAIN = ["gemini-3-flash-preview", "gemini-1.5-flash"];

async function generateWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[generate-script] Trying ${modelName} (attempt ${attempt + 1})`);
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode || 0;
        const isRetryable = status === 503 || status === 429 || err?.message?.includes("503") || err?.message?.includes("429") || err?.message?.includes("high demand") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRetryable && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[generate-script] ${modelName} returned ${status}, retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (isRetryable) { break; }
        throw err;
      }
    }
  }
  throw new Error("All AI models are currently overloaded. Please try again in a minute.");
}

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
  return Math.ceil(duration / 12);
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
  Available Images from website (DISTRIBUTE across scenes):
${images.map((img: any, i: number) => `    Image ${i + 1}: ${img.url} (${img.alt || img.context})`).join("\n")}
`;
    }

    const systemPrompt = [
      "You are an elite creative director and SaaS launch filmmaker.",
      "You generate CINEMATIC scene plans for premium product showcase videos.",
      "",
      "Your scene plans must produce videos comparable to Apple launches, Stripe visuals, Linear promos, and Vercel launch videos.",
      "NOT PowerPoint. NOT slideshows. NOT generic motion graphics.",
      "",
      brandContext,
      "",
      `USER REQUEST: ${prompt}`,
      "",

      // ═══ DURATION & SCENE COUNT ═══
      "════════════════════════════════════════",
      " DURATION & SCENE REQUIREMENTS",
      "════════════════════════════════════════",
      "",
      `TARGET DURATION: EXACTLY ${targetDuration} seconds`,
      `REQUIRED SCENES: EXACTLY ${sceneCount} scenes`,
      `AVERAGE PER SCENE: ${Math.round(targetDuration / sceneCount)} seconds`,
      "",
      `THE SUM OF ALL SCENE DURATIONS MUST EQUAL EXACTLY ${targetDuration} SECONDS.`,
      "",

      // ═══ STORYTELLING STRUCTURE ═══
      "════════════════════════════════════════",
      " SCENE STORYTELLING STRUCTURE",
      "════════════════════════════════════════",
      "",
      "Structure scenes with PROFESSIONAL storytelling flow — NOT just a feature list.",
      "",
      "VIDEO TYPE TEMPLATES:",
      '- "product-launch": Cinematic Hook → Problem → Solution → Product Reveal → Features ×2-3 → Social Proof → CTA → Outro',
      '- "feature-explainer": Hook → Context → Feature 1 → Feature 2 → Feature 3 → Benefits → Demo → CTA',
      '- "website-hero": Brand Intro → Value Prop → Key Visual → Features → Demo → Social Proof → CTA',
      '- "ad-creative": Hook → Problem → Agitation → Solution → Demo → Proof → CTA',
      '- "social-teaser": Hook → Quick Demo → Feature Flash ×3 → CTA',
      '- "general": Hook → Main Content ×2-3 → Supporting Points ×2-3 → Visual Break → CTA',
      "",
      `VIDEO TYPE: ${videoType || "general"}`,
      "",

      // ═══ VISUAL DIRECTION FOR EACH SCENE ═══
      "════════════════════════════════════════",
      " VISUAL DIRECTION GUIDELINES",
      "════════════════════════════════════════",
      "",
      'The "visual" field MUST describe CINEMATIC motion design, not just "show the product".',
      "",
      "GOOD visual directions:",
      '  "Cinematic dark gradient background with floating particles. Bold headline reveals word-by-word with spring animation. Subtle gradient orbs drift in background."',
      '  "Device-framed screenshot enters from bottom with spring scale. Glassmorphism cards overlay highlighting key features. Animated cursor simulates clicking."',
      '  "Split layout: kinetic text left, product screenshot right with 3D perspective tilt. Staggered feature bullets animate in."',
      '  "Animated counter cards spring in one by one. Numbers count up. Glassmorphism panel with glow border."',
      "",
      "BAD visual directions (NEVER write these):",
      '  "Show the product" (too vague)',
      '  "Display features" (no motion direction)',
      '  "Zoom into screenshot" (too basic)',
      "",
      "Each scene MUST have a DIFFERENT layout and composition. VARY between:",
      "  * Centered hero composition",
      "  * Split-screen (text left, visual right)",
      "  * Full-bleed screenshot with glassmorphism overlay cards",
      "  * Grid/bento layout for multiple features",
      "  * Focused metric/counter display",
      "",

      // ═══ SCREENSHOT & IMAGE RULES ═══
      "════════════════════════════════════════",
      " SCREENSHOT ANIMATION RULES",
      "════════════════════════════════════════",
      "",
      "When screenshots are available, the visual direction MUST include:",
      "  * Device-frame treatment (rounded corners, shadow, border)",
      "  * NEVER just zoom — isolate UI regions, animate elements, simulate cursor",
      "  * Spotlight effects on key areas",
      "  * Layered depth (screenshot behind, cards in front)",
      "  * Flow between multiple screenshots (slide transitions)",
      "",

      // ═══ AI CREATIVE DIRECTOR ═══
      "════════════════════════════════════════",
      " AI CREATIVE DIRECTOR MODE",
      "════════════════════════════════════════",
      "",
      "Auto-detect brand type and select creative direction:",
      "  * Fintech → clean, premium, gold/navy, confident",
      "  * AI/ML → futuristic, neon, particles, energetic",
      "  * Enterprise SaaS → polished, structured, trustworthy",
      "  * Dev tools → dark, monospace accents, smooth",
      "  * Productivity → elegant, calm, spacious",
      "  * Creative tools → bold, expressive, dynamic",
      "  * E-commerce → vibrant, fast, product-focused",
      "",
      "Choose musicMood based on brand type (cinematic, upbeat, chill, tech, luxury, dramatic, energetic).",
      "",

      // ═══ TEMPLATES ═══
      "════════════════════════════════════════",
      " AVAILABLE TEMPLATES",
      "════════════════════════════════════════",
      "",
      '"KineticHero" — Bold kinetic typography, staggered word reveals. Best for: hook, intro, CTA.',
      '"BentoGrid" — Apple-style grid layout, 3-4 feature cards. Best for: features, demo.',
      '"FeatureShowcase" — Full-screen hero image with text overlay. Best for: demo, solution.',
      '"SplitScreen" — Left text / right image with slide-in. Best for: problem, solution.',
      '"StatCounter" — Animated number counters. Best for: social-proof, metrics.',
      '"LogoReveal" — Cinematic logo entrance. Best for: intro, outro, CTA.',
      "",

      // ═══ RULES ═══
      "════════════════════════════════════════",
      " RULES",
      "════════════════════════════════════════",
      "",
      "1. Output ONLY valid JSON — no markdown, no explanation.",
      "2. Each scene: id (number), type, duration (seconds), title, text (on-screen copy), visual (DETAILED motion direction), templateName",
      "3. DISTRIBUTE brand images across scenes — every visual scene should have imageUrl",
      "4. Use the brand's ACTUAL headlines, features, CTA — NOT generic copy",
      `5. SUM of durations MUST EQUAL EXACTLY ${targetDuration} seconds`,
      `6. EXACTLY ${sceneCount} scenes`,
      "7. TEXT in each scene: MAX 5-7 WORDS. Think billboard, not paragraph.",
      "8. VARY templateName across scenes — never use the same template for more than 2 consecutive scenes",
      "",

      // ═══ OUTPUT FORMAT ═══
      "OUTPUT FORMAT:",
      "{",
      '  "scenes": [',
      `    { "id": 1, "type": "hook", "duration": ${Math.round(targetDuration / sceneCount)}, "title": "...", "text": "...", "visual": "DETAILED motion direction...", "imageUrl": "...", "templateName": "KineticHero" },`,
      `    ...${sceneCount} scenes total...`,
      "  ],",
      `  "totalDuration": ${targetDuration},`,
      '  "musicMood": "..."',
      "}",
    ].join("\n");

    let text = await generateWithRetry(systemPrompt);

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
      const ratio = targetDuration / actualTotal;
      let running = 0;
      scenePlan.scenes.forEach((sc, i) => {
        if (i === scenePlan.scenes.length - 1) {
          sc.duration = targetDuration - running;
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
