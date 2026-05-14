import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getModelChain } from "@/lib/gemini-models";
import { validateGodTemplatePayload } from "@/lib/god-template-validator";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function clampWords(text: string, maxWords: number): string {
  const w = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return w.slice(0, maxWords).join(" ");
}

async function generateWithRetry(modelNames: string[], prompt: string, maxRetries = 3): Promise<string> {
  for (const modelName of modelNames) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { maxOutputTokens: 8192 },
    });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[generate-video] Trying ${modelName} (attempt ${attempt + 1})`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode || 0;
        const isRetryable = status === 503 || status === 429 || err?.message?.includes("503") || err?.message?.includes("429") || err?.message?.includes("high demand") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRetryable && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[generate-video] ${modelName} returned ${status}, retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (isRetryable) {
          console.log(`[generate-video] ${modelName} exhausted retries, trying next model...`);
          break; // try next model
        }
        throw err; // non-retryable error
      }
    }
  }
  throw new Error("All AI models are currently overloaded. Please try again in a minute.");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 300);

    // Build brand injection block
    let brandBlock = "";
    if (brandKit) {
      const images = Array.isArray(brandKit.images) ? brandKit.images : [];
      const proxyUrl = (url: string) => {
        if (!url || url === "none") return "none";
        return `/api/image-proxy?url=${encodeURIComponent(url)}`;
      };
      const proxiedLogo = brandKit.logoUrl ? proxyUrl(brandKit.logoUrl) : "none";
      const proxiedImages = images.map((img: any) => ({
        ...img,
        url: proxyUrl(img.url),
      }));

      brandBlock = `
BRAND IDENTITY — USE THESE EXACTLY
Company Name: ${brandKit.headline || brandKit.name || ""}
Tagline: ${brandKit.subheadline || ""}
Primary Color: ${brandKit.colors?.primary || "#3B82F6"}
Secondary Color: ${brandKit.colors?.secondary || "#7C3AED"}
Accent Color: ${brandKit.colors?.accent || "#06B6D4"}
Full Palette: [${(brandKit.brandPalette || []).map((c: string) => `"${c}"`).join(", ")}]
Font Family: "${brandKit.fonts?.heading || "Inter"}"
Motion Style: ${brandKit.style || "modern"} / ${brandKit.tone || "professional"}
Aesthetic: ${brandKit.aesthetic || "AUTO"}
CTA Text: "${brandKit.cta || "Get Started"}"
Logo URL: ${proxiedLogo}
BRAND IMAGES — PROXIED AND WILL RENDER:
${proxiedImages.length > 0 ? proxiedImages.map((img: any, i: number) =>
  `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context || "brand visual"}`
).join("\n") : "  No brand images available"}
`;
    }

    // Build scene-specific instructions
    let sceneBlock = "";
    if (scene) {
      const sceneImgUrl = scene.imageUrl
        ? `/api/image-proxy?url=${encodeURIComponent(scene.imageUrl)}`
        : "";
      const textForProps = clampWords(scene.text, 8);
      const visualBrief = String(scene.visual || "").slice(0, 480);
      sceneBlock = `
SCENE INSTRUCTIONS
Scene Type: ${scene.type}
Scene Title: ${scene.title}
On-Screen Text (use in props — max ~8 words; split across headline/subheadline if needed): "${textForProps}"
Visual Direction (motion beats, parallax, layers — not marketing prose): ${visualBrief}${String(scene.visual || "").length > 480 ? "…" : ""}
${sceneImgUrl ? `Screenshot / asset URL for THIS scene (PROXIED — if you show it, pass as props.imageUrl or BentoGrid images[] entry): "${sceneImgUrl}"` : ""}
Duration: ${duration} seconds (${duration * 30} frames)
Generate ONLY this single scene — it will be stitched with others.
`;
    }

    const systemPrompt = `
You are an elite motion design Creative Director.
Your task is to select the perfect high-end video template and configure its props based on the user's request and brand identity.

MOTION DENSITY: Favor layered, continuous animation — parallax, staggered reveals, gradient shifts, subtle scale breathing, drifting light orbs, and micro-easing on every prop that can move. Avoid static layouts; every scene should feel "alive" like a top-tier SaaS launch film.

AVAILABLE TEMPLATES:
1. "KineticHero" — Giant kinetic typography with word-by-word reveals, floating particles, gradient orbs.
   Best for: hook, intro, bold statements, opening scenes.
   Props: { headline (string, 2-5 impactful words), subheadline (string, 1-2 sentences), imageUrl (string, optional — ONLY soft/abstract mood, NEVER a full product UI screenshot; omit imageUrl when showing readable UI matters) }

2. "BentoGrid" — Apple-style grid of glassmorphism feature cards with staggered 3D scale reveals.
   Best for: features, demo, solution, product overview.
   Props: { headline (string), features (array of 3-4 short feature names), images (array of up to 4 image URLs) }

3. "FeatureShowcase" — Large framed product/UI shot: renderer uses object-fit CONTAIN (full screenshot visible, letterboxed if aspect differs). Short text band at bottom only.
   Best for: demo, solution, features ONLY (product proof). Do NOT use for hook/problem/cta/social-proof.
   Props: { headline (string, max ~6 words), subheadline (string, optional), imageUrl (string, REQUIRED when you pick this template) }

4. "SplitScreen" — Left text / right panel. Screenshot uses CONTAIN (no crop, no Ken Burns).
   Best for: problem, solution, comparison, before/after when you need readable UI beside copy.
   Props: { headline (string, bold claim), subheadline (string, supporting detail), imageUrl (string, optional — use for curated UI / marketing still) }

5. "StatCounter" — Animated odometer-style number counters in glassmorphism cards with glow effects.
   Best for: social-proof, metrics, trust signals.
   Props: { headline (string, optional), stats (array of {value: "10K+", label: "Active Users"}, up to 4) }

6. "LogoReveal" — Cinematic logo entrance with expanding rings, particles, and CTA button.
   Best for: intro, outro, CTA, brand reveal.
   Props: { headline (string), subheadline (string, optional), ctaText (string, optional), imageUrl (string, logo URL) }

7. "ProductOrbit3D" — 3D floating product slab with subtle camera dolly and rotation (WebGL).
   Best for: premium hero, hardware, flagship moment, "wow" tech shots — NO screenshot required.
   Props: { headline (string), subheadline (string, optional), primaryColor (string, hex from brand) }

8. "DemoBrowserWalkthrough" — Browser chrome + animated cursor. Screenshot area uses CONTAIN (entire capture visible, not cropped).
   Best for: UI walkthrough, feature tour, click path storytelling — use sparingly across the full video.
   Props: { headline (string), subheadline (string, optional), imageUrl (string, screenshot URL) }

9. "LottieOverlay" — Full-frame Lottie motion graphic (when you have valid Lottie JSON).
   Best for: logo sting, icon burst, pre-designed motion from designers.
   Props: { headline (string, optional), animationData (object, REQUIRED — valid Lottie JSON). If you cannot supply JSON, do NOT pick this template. }

10. "IntegrationShowcase" — Staggered row of partner logos with glass pills and continuous horizontal drift.
   Best for: integrations, partner ecosystem, trust strip.
   Props: { headline (string), subheadline (string, optional), logos (array of { name: string, imageUrl?: string }, up to 8) }

11. "TestimonialSpotlight" — Large quote typography with author line and soft radial glow.
   Best for: customer proof, testimonial beat.
   Props: { headline (string, short attribution e.g. company), subheadline (string, the quote — max ~20 words), imageUrl (string, optional headshot) }

12. "ComparisonSplit" — Two-column contrast (before/after or us vs them) with animated center divider.
   Best for: problem vs solution, differentiation.
   Props: { headline (string), subheadline (string), leftLabel (string), rightLabel (string), imageUrl (string, optional hero) }

13. "OrbFieldHero" — Pure motion: layered gradient orbs, conic mesh, NO product screenshot. Headline only.
   Best for: hook, problem, energy beats between UI shots.
   Props: { headline (string, max ~6 words), subheadline (string, optional, max ~12 words) }

14. "GlyphRhythm" — Animated EQ-style bars + particle field, kinetic typography. NO screenshot.
   Best for: mid-video abstract interlude, metrics vibe without real numbers, tech pulse.
   Props: { headline (string, max ~6 words), subheadline (string, optional) }

${brandBlock}
${sceneBlock}

USER REQUEST:
Prompt: ${prompt}
Duration: ${duration} seconds
Aspect: ${aspectVideo ?? "16:9"}
${scene?.templateName ? `REQUESTED TEMPLATE: "${scene.templateName}" — YOU MUST use this template.` : ""}

RULES:
1. ${scene?.templateName ? `Use the template "${scene.templateName}" as instructed.` : "Choose the BEST template for the scene type and content."}
2. Headline / on-screen copy: MAX ~6 WORDS in headline fields; subheadlines MAX ~12 words unless testimonial quote.
3. SCREENSHOT ROUTING (read Scene Type + whether a scene image URL exists):
   - type "demo" → prefer "DemoBrowserWalkthrough" (full UI in browser) OR "FeatureShowcase" (large framed shot).
   - type "solution" or "features" → prefer "FeatureShowcase" or "BentoGrid" (map distinct shots to images[]).
   - type "problem" or "comparison" beats → prefer "SplitScreen" with imageUrl on the right when a visual helps.
   - type "hook", "intro", "cta", "outro" with a PRODUCT UI image → prefer "SplitScreen" or "FeatureShowcase", NOT "KineticHero" (do not use dashboard screenshots as KineticHero background).
   - type "hook" / "intro" with NO imageUrl in scene → "OrbFieldHero", "GlyphRhythm", "ProductOrbit3D", or "KineticHero" without imageUrl.
   - "LogoReveal" imageUrl = logo only, not a full-page app capture.
4. If a scene provides a screenshot URL above, you MUST wire it into props.imageUrl (or images[]) for the template you pick — never ignore a provided UI capture.
5. Renderer keeps UI shots fully visible (contain). Do NOT simulate aggressive zoom-in/out on screenshots in your template choice logic.
6. Brand images in the brand block: pick the ONE that best matches this scene's title/visual; do not dump unrelated shots.
7. For StatCounter, invent realistic-sounding metrics if none are provided.
8. Output EXACTLY valid JSON, nothing else. No markdown, no explanation.

OUTPUT FORMAT:
{
  "type": "template",
  "templateName": "...",
  "props": { ... }
}
      `;

    let text = await generateWithRetry(getModelChain("video"), systemPrompt);

    const cleanCode = text
      .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    console.log("Generated Code Length:", cleanCode.length);

    const models = getModelChain("video");
    const cleanJson = (s: string) =>
      s
        .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
        .replace(/\n?```\s*$/gim, "")
        .trim();

    let rawOut = cleanCode;
    let parsedOut: Record<string, unknown>;

    try {
      parsedOut = JSON.parse(rawOut) as Record<string, unknown>;
    } catch (e) {
      console.error("Failed to parse God Template JSON:", e);
      const fallbackJSON = {
        type: "template",
        templateName: "KineticHero",
        props: {
          headline: "Error Parsing JSON",
          subheadline: "The AI returned invalid format.",
          primaryColor: "#ef4444",
          backgroundColor: "#000",
          textColor: "#fff",
          fontFamily: "Inter",
        },
      };
      return NextResponse.json({ videoCode: JSON.stringify(fallbackJSON), duration });
    }

    let valIssues = validateGodTemplatePayload(parsedOut, scene);
    if (valIssues.length > 0) {
      console.warn("[generate-video] God template validation:", valIssues);
      const fixPrompt = `${systemPrompt}\n\n---\nYOUR PREVIOUS OUTPUT WAS INVALID. Reply with ONLY corrected JSON (same schema). Issues:\n${valIssues.map((x) => `- ${x}`).join("\n")}`;
      try {
        const text2 = await generateWithRetry(models, fixPrompt);
        rawOut = cleanJson(text2);
        parsedOut = JSON.parse(rawOut) as Record<string, unknown>;
        valIssues = validateGodTemplatePayload(parsedOut, scene);
        if (valIssues.length > 0) {
          console.warn("[generate-video] God template still invalid after retry:", valIssues);
        }
      } catch (e2) {
        console.error("[generate-video] Validation retry failed:", e2);
      }
    }

    const prevProps =
      typeof parsedOut.props === "object" && parsedOut.props !== null
        ? (parsedOut.props as Record<string, unknown>)
        : {};
    parsedOut.props = {
      ...prevProps,
      primaryColor: brandKit?.colors?.primary || "#3B82F6",
      secondaryColor: brandKit?.colors?.secondary || "#7C3AED",
      backgroundColor: brandKit?.colors?.background || "#0F172A",
      textColor: brandKit?.colors?.text || "#FFFFFF",
      fontFamily: brandKit?.fonts?.heading || "Inter",
    };
    return NextResponse.json({ videoCode: JSON.stringify(parsedOut), duration });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video code." },
      { status: 500 }
    );
  }
}
