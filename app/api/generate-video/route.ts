import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 60);

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Build brand injection block
    let brandBlock = "";
    if (brandKit) {
      const images = Array.isArray(brandKit.images) ? brandKit.images : [];
      brandBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND IDENTITY — USE THESE EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company Name: ${brandKit.headline || brandKit.name || ""}
Tagline: ${brandKit.subheadline || ""}
Primary Color: ${brandKit.colors?.primary || "#3B82F6"}
Secondary Color: ${brandKit.colors?.secondary || "#7C3AED"}
Accent Color: ${brandKit.colors?.accent || "#06B6D4"}
Full Palette: [${(brandKit.brandPalette || []).map((c: string) => `"${c}"`).join(", ")}]
Background: ${brandKit.colors?.background || "#0F172A"}
Text Color: ${brandKit.colors?.text || "#FFFFFF"}
Font Family: "${brandKit.fonts?.heading || "Inter"}"
Motion Style: ${brandKit.style || "modern"} / ${brandKit.tone || "professional"}
CTA Text: "${brandKit.cta || "Get Started"}"
Logo URL: ${brandKit.logoUrl || "none"}

BRAND IMAGES — Use these with <Img> component:
${images.length > 0 ? images.map((img: any, i: number) =>
  `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context} — animate with Ken Burns zoom, parallax, or 3D tilt`
).join("\n") : "  No brand images available — use abstract/geometric visuals instead"}

RULES FOR BRAND:
• Use the EXACT brand colors above — NOT random blue/purple.
• If logo URL exists, display the logo using <Img src="${brandKit.logoUrl}"> in the intro/outro.
• If brand images exist, use them as hero backgrounds, product showcases, or visual elements.
• Apply the brand's font family to ALL text: fontFamily: '${brandKit.fonts?.heading || "Inter"}, sans-serif'
• Match the brand's tone: ${brandKit.tone || "professional"}
`;
    }

    // Build scene-specific instructions
    let sceneBlock = "";
    if (scene) {
      sceneBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scene Type: ${scene.type}
Scene Title: ${scene.title}
On-Screen Text: "${scene.text}"
Visual Direction: ${scene.visual}
${scene.imageUrl ? `Featured Image: "${scene.imageUrl}" — make this the hero element of this scene, animate it prominently` : ""}
Duration: ${duration} seconds (${duration * 30} frames)

Generate ONLY this single scene — it will be stitched with others.
`;
    }

    const systemPrompt = `
You are a world-class Remotion + React motion-graphics engineer.
Your single task is to output a COMPLETE, RUNNABLE React component that produces a stunning, professional video.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Start EXACTLY with: const MyComposition = () => {
• Do NOT write any import statements.
• Do NOT write export default.
• Do NOT wrap in markdown fences.
• Use only the APIs listed in the AVAILABLE APIs section below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE APIs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remotion hooks / primitives (pre-injected, use directly):
  useCurrentFrame, useVideoConfig, spring, interpolate, interpolateColors,
  AbsoluteFill, Sequence, Series, Loop, Audio, Img, staticFile,
  Easing, random

Lucide icons (pre-injected):
  Cloud, Shield, Zap, Settings, Mail, Lock, User, Star, Heart, Globe,
  Search, Bell, Check, X, ArrowRight, Video, Monitor, Cpu, Database,
  Music, Activity, Play, Pause, FastForward, Rewind, Layers, Layout,
  MousePointer, Smartphone, Tablet, Laptop, Tv, Camera, Image, Gift,
  ShoppingCart, CreditCard, Wallet, Home, MapPin, Navigation, Compass,
  Sunrise, Sunset, Moon, Sun, Wind, Droplets, Flame, Leaf, Coffee,
  Pizza, Bike, Car, Plane, Anchor, BarChart, PieChart, TrendingUp,
  Briefcase, Rocket, Sparkles, Wand2, Lightbulb, PenTool, Hash,
  Info, AlertCircle, AlertTriangle, HelpCircle

Standard browser globals available: Math, Array, Date, SVGElement, etc.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIO — MANDATORY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1: You MUST place an <Audio> tag as the VERY FIRST child inside the outermost <AbsoluteFill>.
RULE 2: The src prop MUST be a HARDCODED string literal — NEVER a variable, constant, or expression.
RULE 3: Always set volume={0.5}.

AUDIO LIBRARY — paste the full URL directly into src="...":
  Upbeat / Corporate / Motivational  → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  Cinematic / Epic / Trailer         → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  Energetic / Dance / Hype           → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  Lofi / Chill / Ambient             → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  Orchestral / Dramatic / Suspense   → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
  Happy / Fun / Playful / Kids       → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
  Peaceful / Nature / Meditative     → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"
  Sci-Fi / Tech / Futuristic         → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
  Jazz / Retro / Vintage / Noir      → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"
  Action / Gaming / Sports           → "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"

${brandBlock}
${sceneBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIDEO STYLE GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brandKit ? `Match the brand style: ${brandKit.style || "modern"}, ${brandKit.tone || "professional"}.
Use the brand's exact colors and font throughout. DO NOT use generic blue/purple.` :
`Read the user's prompt carefully and pick ONE primary style, then enrich with secondary techniques.
Use vibrant, professional color palettes.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIVERSAL QUALITY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CSS:
  • NEVER mix 'background' and 'backgroundColor' on the same element — pick one.
  • ALWAYS use style objects: style={{ transform: \`translateY(\${y}px)\` }}
  • Use position:'absolute' with top/left/right/bottom for layering.

Animations:
  • const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
  • Use spring() for natural motion: spring({ frame, fps, config:{ damping:12, stiffness:100 } })
  • Use interpolate() with clamp: interpolate(frame,[0,30],[0,1],{ extrapolateLeft:'clamp', extrapolateRight:'clamp' })
  • Stagger elements by 6-10 frames for "pop" effect.

Structure:
  • Break into logical <Sequence from={n} durationInFrames={m}> blocks.
  • Use <AbsoluteFill> as root inside each sequence.
  • Always animate a background (gradient or colour shift) — never solid static.

Images:
  • Use <Img> (not <img>) for all images.
  ${brandKit?.images?.length > 0 ? `• PRIORITIZE brand images listed above over stock photos.` : `• Use safe Unsplash URLs for stock imagery.`}
  • Always animate <Img> with a scale or position over time (Ken Burns).
  • NEVER use loremflickr.com — it causes timeouts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Prompt   : ${prompt}
Duration : ${duration} seconds (= ${duration * 30} frames at 30 fps)
Aspect   : ${aspectVideo}

Now generate the best possible, fully animated, production-quality MyComposition component.
    `;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();

    const cleanCode = text
      .replace(/^```(?:jsx?|tsx?|javascript|typescript)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    console.log("Generated Code Length:", cleanCode.length);

    return NextResponse.json({ videoCode: cleanCode, duration });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video code." },
      { status: 500 }
    );
  }
}