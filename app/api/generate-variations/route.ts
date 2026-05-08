import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODEL_CHAIN = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

async function generateWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[generate-variations] Trying ${modelName} (attempt ${attempt + 1})`);
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode || 0;
        const isRetryable = status === 503 || status === 429 || err?.message?.includes("503") || err?.message?.includes("429") || err?.message?.includes("high demand") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRetryable && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[generate-variations] ${modelName} returned ${status}, retrying in ${Math.round(delay)}ms...`);
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

// Generate multiple variations of hooks, CTAs, or styles
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, variationType, count, brandKit } = await req.json();
    // variationType: "hooks" | "ctas" | "styles" | "angles"
    // count: 3-5



    const brandContext = brandKit ? `
Brand: ${brandKit.headline || brandKit.name || ""}
Colors: ${JSON.stringify(brandKit.colors || {})}
Tone: ${brandKit.tone || "professional"}
CTA: ${brandKit.cta || "Get Started"}
Features: ${JSON.stringify((brandKit.features || []).slice(0, 4))}
` : "";

    const variationPrompts: Record<string, string> = {
      hooks: `Generate ${count || 5} different video HOOKS (opening 3-5 seconds) for this video. Each should be a completely different approach to grab attention. Include: the hook text, visual approach, and emotion.`,
      ctas: `Generate ${count || 5} different CTA (call-to-action) endings for this video. Each should use a different persuasion technique. Include: CTA text, visual treatment, urgency level.`,
      styles: `Generate ${count || 5} different visual STYLE variations for this video. Each should feel completely different (e.g., minimal, bold, neon, cinematic, playful). Include: style name, color mood, motion style, typography approach.`,
      angles: `Generate ${count || 5} different creative ANGLES for this video. Each should tell the story from a different perspective (e.g., problem-first, benefit-first, testimonial, data-driven, emotional). Include: angle name, narrative approach, key message.`,
    };

    const systemPrompt = `You are a creative director generating variations for a marketing video.

${brandContext}

VIDEO CONCEPT: ${prompt}

${variationPrompts[variationType] || variationPrompts.styles}

Output ONLY valid JSON array. Each item should have: "id" (number), "name" (string), "description" (string), "promptModifier" (string that can be appended to the generation prompt).

Example: [{"id":1,"name":"Bold & Direct","description":"High contrast, big text...","promptModifier":"Use bold typography, high contrast colors, fast cuts..."}]`;

    let text = await generateWithRetry(systemPrompt);
    text = text
      .replace(/^```(?:json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    const variations = JSON.parse(text);

    return NextResponse.json({ variations, variationType });
  } catch (error: any) {
    console.error("[generate-variations] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate variations" }, { status: 500 });
  }
}
