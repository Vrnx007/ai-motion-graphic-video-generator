import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { validateScenePlan, maxScreenshotHeavyScenes, minMotionFirstScenes } from "@/lib/script-plan-validator";
import { getModelChain } from "@/lib/gemini-models";
import { assignBrandImagesToScenes } from "@/lib/scene-image-mapper";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function generateWithRetry(modelNames: string[], prompt: string, maxRetries = 3): Promise<string> {
  for (const modelName of modelNames) {
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
  Preferred Aesthetic: ${brandKit.aesthetic || "AUTO - Derive from brand colors/industry"}
  CTA Text: ${brandKit.cta || "Get Started"}
  Features: ${JSON.stringify(brandKit.features || [])}
  Testimonials (use for dedicated social-proof scene when non-empty): ${JSON.stringify(brandKit.testimonials || [])}
  Integrations / partners (use TestimonialSpotlight or IntegrationShowcase templates when relevant): ${JSON.stringify(brandKit.integrations || [])}
  Pricing cues (short on-screen numbers only, do not invent prices): ${JSON.stringify(brandKit.pricingCues || [])}
  Logo URL: ${brandKit.logoUrl || "N/A"}
  Available Images from website (USER-CURATED — use ONLY these URLs, do not invent or substitute):
${images.length ? images.map((img: { url: string; alt?: string; context?: string }, i: number) => `    Image ${i + 1}: ${img.url} (${img.alt || img.context || "asset"})`).join("\n") : "    (none — prefer typography / abstract scenes)"}
  The user may have removed irrelevant assets; respect this list exactly.
`;
    }

    const maxHeavy = maxScreenshotHeavyScenes(sceneCount);
    const minMotion = minMotionFirstScenes(sceneCount);

    const systemPrompt = [
      "You are an elite creative director and SaaS launch filmmaker.",
      "You generate CINEMATIC scene plans for premium product showcase videos.",
      "",
      "Voice and taste: confident, minimal copy, luxury-tech tone (Stripe, Linear, Vercel, Apple keynote energy).",
      "Avoid cheesy superlatives, exclamation overload, or generic marketing clichés.",
      "",
      "MOTION RICHNESS (mandatory in every scene's visual field):",
      "  - Stack 3+ coordinated motions per scene (e.g. slow parallax drift + staggered text + gradient pulse + subtle grain).",
      "  - Prefer continuous micro-motion (floating, breathing scale, light leaks, soft blur orbs) over static slides.",
      "  - Each scene should feel like a high-end product film beat, not a PowerPoint slide.",
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
      `SCREENSHOT-FIRST BUDGET: At most ${maxHeavy} scene(s) may use "FeatureShowcase" or "DemoBrowserWalkthrough" combined (full-bleed or framed UI).`,
      `MOTION-FIRST FLOOR: At least ${minMotion} scene(s) MUST use "KineticHero", "ProductOrbit3D", "StatCounter", "OrbFieldHero", "GlyphRhythm", or "LogoReveal" (no product screenshot as hero).`,
      "",
      "ON-SCREEN TEXT: each scene `text` field MAX 14 WORDS (billboard). Put detail in `visual` (motion choreography), not in `text`.",
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
      "NARRATIVE ARC (mandatory ordering by scene index):",
      "- Scene 1 MUST be a hook or intro (attention).",
      "- Middle scenes MUST progress: problem/context → product/solution → benefits/features → demo or proof.",
      "- The FINAL scene MUST be cta or outro with a clear call-to-action line in `text`.",
      "- If brandKit.testimonials is non-empty, allocate EXACTLY one scene with type social-proof and templateName TestimonialSpotlight.",
      "- If brandKit.integrations is non-empty, allocate at least one scene using templateName IntegrationShowcase or ComparisonSplit.",
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
      '  "Split layout: kinetic text left, abstract floating 3D icons right. Staggered feature bullets animate in with continuous drift."',
      '  "Animated counter cards spring in one by one. Numbers count up. High-saturation background with glow border."',
      "",
      "BAD visual directions (NEVER write these):",
      '  "Show the product" (too vague)',
      '  "Display features" (no motion direction)',
      '  "Zoom into screenshot" (too basic)',
      "",
      "CRITICAL DIVERSITY RULE: You MUST mix different types of scenes. DO NOT make every scene a screenshot.",
      "  - Use 1-2 scenes for high-level abstract concepts using typography and floating icons.",
      "  - Use 1-2 scenes for actual product UI screenshots (Device-framed).",
      "  - Use 1 scene for kinetic typography (large text, no images).",
      "",
      "Each scene MUST have a DIFFERENT layout and composition. VARY between:",
      "  * Centered hero composition (Text focus)",
      "  * Split-screen (Text left, visual/icons right)",
      "  * Full-bleed screenshot with glassmorphism overlay cards",
      "  * Grid/bento layout for multiple abstract features",
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
      '"FeatureShowcase" — Full-screen hero image. ONLY for demo/solution/features scenes — never for hook/problem/cta.',
      '"SplitScreen" — Left text / right image. Best for: problem, solution.',
      '"StatCounter" — Animated number counters. Best for: social-proof, metrics.',
      '"LogoReveal" — Cinematic logo entrance. Best for: intro, outro, CTA.',
      '"ProductOrbit3D" — WebGL 3D slab, no screenshot. Best for: premium beats, hook, wow moments.',
      '"DemoBrowserWalkthrough" — Browser chrome + cursor on screenshot. Best for: UI tour — use sparingly (counts toward screenshot budget).',
      '"OrbFieldHero" — Pure gradient/orb motion, no screenshot. Best for: hook, abstract beats.',
      '"GlyphRhythm" — EQ bars + particles, no screenshot. Best for: interludes, tech pulse.',
      '"ParticleStorm" — 220-particle field + volumetric light cone + chromatic-aberration title. CINEMATIC opener / mid-beat. No screenshot.',
      '"MorphHeadline" — Letter-by-letter kinetic title with spring + blur + rotating glyph ghosts. Best for: hero claim, wow moment, taglines. No screenshot.',
      '"IntegrationShowcase" — Horizontal partner / integration logos with staggered motion. Best for: proof, ecosystem, trust strip.',
      '"TestimonialSpotlight" — Quote card with author, subtle parallax, glow frame. Best for: social-proof, testimonial.',
      '"ComparisonSplit" — Before/after or us-vs-them split with kinetic divider. Best for: problem, differentiation.',
      "",

      // ═══ RULES ═══
      "════════════════════════════════════════",
      " RULES",
      "════════════════════════════════════════",
      "",
      "1. Output ONLY valid JSON — no markdown, no explanation.",
      "2. Each scene: id (number), type, duration (seconds), title, text (on-screen copy, MAX 14 WORDS), visual (DETAILED motion direction), templateName",
      "3. imageUrl is OPTIONAL — when set, it MUST be a curated UI/screenshot for THIS scene; pair with template: demo→DemoBrowserWalkthrough or FeatureShowcase; solution/features→FeatureShowcase or BentoGrid images[]; problem→SplitScreen; never use a full UI capture as KineticHero background.",
      "4. Use the brand's ACTUAL headlines, features, CTA — NOT generic copy",
      `5. SUM of durations MUST EQUAL EXACTLY ${targetDuration} seconds`,
      `6. EXACTLY ${sceneCount} scenes`,
      "7. TEXT in each scene: MAX 14 WORDS in the `text` field (billboard).",
      "8. VARY templateName across scenes — never use the same template for more than 2 consecutive scenes",
      "",

      // ═══ OUTPUT FORMAT ═══
      "OUTPUT FORMAT:",
      "{",
      '  "scenes": [',
      `    { "id": 1, "type": "hook", "duration": ${Math.round(targetDuration / sceneCount)}, "title": "...", "text": "max 14 words", "visual": "DETAILED motion direction...", "templateName": "OrbFieldHero" },`,
      `    ...${sceneCount} scenes total...`,
      "  ],",
      `  "totalDuration": ${targetDuration},`,
      '  "musicMood": "..."',
      "}",
    ].join("\n");

    let text = await generateWithRetry(getModelChain("script"), systemPrompt);

    // Clean up Gemini output
    text = text
      .replace(/^```(?:json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    // Parse and validate
    let scenePlan: ScenePlan = JSON.parse(text);

    if (!scenePlan.scenes || !Array.isArray(scenePlan.scenes)) {
      throw new Error("Invalid scene plan: missing scenes array");
    }

    const normalizeDurations = (plan: ScenePlan) => {
      for (const sc of plan.scenes) {
        sc.duration = Math.max(0, Math.round(Number(sc.duration) || 0));
      }
      let actualTotal = plan.scenes.reduce((s, sc) => s + sc.duration, 0);
      if (!Number.isFinite(actualTotal) || actualTotal <= 0) {
        const n = plan.scenes.length;
        const base = Math.max(3, Math.floor(targetDuration / Math.max(n, 1)));
        let run = 0;
        plan.scenes.forEach((sc, i) => {
          if (i === n - 1) sc.duration = Math.max(3, targetDuration - run);
          else {
            sc.duration = base;
            run += base;
          }
        });
        actualTotal = plan.scenes.reduce((s, sc) => s + sc.duration, 0);
      }
      if (actualTotal !== targetDuration) {
        const ratio = targetDuration / actualTotal;
        let running = 0;
        plan.scenes.forEach((sc, i) => {
          if (i === plan.scenes.length - 1) {
            sc.duration = Math.max(3, targetDuration - running);
          } else {
            sc.duration = Math.max(3, Math.round(sc.duration * ratio));
            running += sc.duration;
          }
        });
        const drift = targetDuration - plan.scenes.reduce((s, sc) => s + sc.duration, 0);
        if (drift !== 0 && plan.scenes.length > 0) {
          const last = plan.scenes[plan.scenes.length - 1];
          last.duration = Math.max(3, last.duration + drift);
        }
      }
      plan.totalDuration = targetDuration;
      if (!plan.musicMood || typeof plan.musicMood !== "string") {
        plan.musicMood = "upbeat tech";
      }
    };

    normalizeDurations(scenePlan);

    let issues = validateScenePlan(scenePlan, sceneCount, targetDuration, videoType || "general");
    if (issues.length > 0) {
      console.warn("[generate-script] Plan validation issues, running repair pass:", issues);
      const repairPrompt = [
        "You fix JSON scene plans for SaaS promo videos.",
        "Return ONLY valid JSON (no markdown). Same schema: { scenes: [...], totalDuration, musicMood }.",
        `TARGET_DURATION_SECONDS: ${targetDuration}`,
        `REQUIRED_SCENE_COUNT: ${sceneCount}`,
        "Fix ALL of the following issues:",
        ...issues.map((i) => `- [${i.code}] ${i.message}`),
        "",
        "Current plan JSON:",
        JSON.stringify(scenePlan),
      ].join("\n");

      let repairRaw = await generateWithRetry(getModelChain("script"), repairPrompt);
      repairRaw = repairRaw
        .replace(/^```(?:json)?\s*\n?/gim, "")
        .replace(/\n?```\s*$/gim, "")
        .trim();
      scenePlan = JSON.parse(repairRaw) as ScenePlan;
      if (!scenePlan.scenes || !Array.isArray(scenePlan.scenes)) {
        throw new Error("Repair pass returned invalid scene plan");
      }
      normalizeDurations(scenePlan);
      issues = validateScenePlan(scenePlan, sceneCount, targetDuration, videoType || "general");
      if (issues.length > 0) {
        console.warn("[generate-script] Repair pass still has issues (returning best effort):", issues);
      }
    }

    // Force curated brand screenshots onto screenshot-friendly scenes so the AI cannot silently drop them.
    const brandImages = Array.isArray(brandKit?.images) ? brandKit.images : [];
    if (brandImages.length > 0) {
      scenePlan.scenes = assignBrandImagesToScenes(
        scenePlan.scenes as unknown as import("@/components/SceneTimeline").Scene[],
        brandImages
      ) as unknown as typeof scenePlan.scenes;
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
