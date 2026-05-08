import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 300);

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

    const useGodTemplates = process.env.USE_GOD_TEMPLATES === "true";

    let systemPrompt = "";

    if (useGodTemplates) {
      // ━━━ NEW: PARAMETRIC TEMPLATE ENGINE (JSON) ━━━
      systemPrompt = `
You are an elite motion design Creative Director.
Your task is to select the perfect high-end video template and configure its props based on the user's request and brand identity.

AVAILABLE TEMPLATES:
1. "KineticHero" — Giant kinetic typography with word-by-word reveals, floating particles, gradient orbs.
   Best for: hook, intro, bold statements, opening scenes.
   Props: { headline (string, 2-5 impactful words), subheadline (string, 1-2 sentences), imageUrl (string, optional background image) }

2. "BentoGrid" — Apple-style grid of glassmorphism feature cards with staggered 3D scale reveals.
   Best for: features, demo, solution, product overview.
   Props: { headline (string), features (array of 3-4 short feature names), images (array of up to 4 image URLs) }

3. "FeatureShowcase" — Full-screen hero image with glassmorphism text overlay at bottom, Ken Burns zoom.
   Best for: demo, solution, product screenshots, visual proof.
   Props: { headline (string, key benefit or feature), subheadline (string, optional detail), imageUrl (string, REQUIRED — the hero image) }

4. "SplitScreen" — Left text / right image layout with slide-in panels and animated divider.
   Best for: problem, solution, comparison, before/after.
   Props: { headline (string, bold claim), subheadline (string, supporting detail), imageUrl (string, optional product image) }

5. "StatCounter" — Animated odometer-style number counters in glassmorphism cards with glow effects.
   Best for: social-proof, metrics, trust signals.
   Props: { headline (string, optional section title), stats (array of {value: "10K+", label: "Active Users"}, up to 4 items) }

6. "LogoReveal" — Cinematic logo entrance with expanding rings, particles, and CTA button.
   Best for: intro, outro, CTA, brand reveal.
   Props: { headline (string, brand or CTA headline), subheadline (string, optional), ctaText (string, optional button text), imageUrl (string, logo URL) }

${brandBlock}
${sceneBlock}

USER REQUEST:
Prompt: ${prompt}
Duration: ${duration} seconds
${scene?.templateName ? `REQUESTED TEMPLATE: "${scene.templateName}" — YOU MUST use this template.` : ""}

TEMPLATE SELECTION GUIDE:
- hook / intro → KineticHero or LogoReveal
- problem → SplitScreen
- solution / demo → FeatureShowcase or SplitScreen
- features → BentoGrid
- social-proof → StatCounter
- cta / outro → LogoReveal
- general → KineticHero

RULES:
1. ${scene?.templateName ? `Use the template "${scene.templateName}" as instructed.` : "Choose the BEST template for the scene type and content."}
2. Extract the best copy from the brand context or prompt. KEEP TEXT EXTREMELY SHORT AND PUNCHY.
3. If brand images are available, ALWAYS assign them to imageUrl or images props. DO NOT leave image props empty when images exist.
4. For StatCounter, invent realistic-sounding metrics if none are provided (e.g. "99.9%" uptime, "10K+" users).
5. Output EXACTLY valid JSON, nothing else. No markdown, no explanation.

OUTPUT FORMAT:
{
  "type": "template",
  "templateName": "...",
  "props": { ... }
}
      `;
    } else {
      // ━━━ LEGACY: GENERATIVE CODE ENGINE (RAW REACT) ━━━
      systemPrompt = `
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
    }

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();

    const cleanCode = text
      .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    console.log("Generated Code Length:", cleanCode.length);

    // If using God Templates, parse the JSON and inject brand colors
    if (useGodTemplates) {
      try {
        const parsed = JSON.parse(cleanCode);
        // Inject brand colors into props so templates can use them
        parsed.props = {
          ...parsed.props,
          primaryColor: brandKit?.colors?.primary || "#3B82F6",
          secondaryColor: brandKit?.colors?.secondary || "#7C3AED",
          backgroundColor: brandKit?.colors?.background || "#0F172A",
          textColor: brandKit?.colors?.text || "#FFFFFF",
          fontFamily: brandKit?.fonts?.heading || "Inter",
        };
        // Return stringified JSON as videoCode
        return NextResponse.json({ videoCode: JSON.stringify(parsed), duration });
      } catch (e) {
        console.error("Failed to parse God Template JSON:", e);
        // Fallback to simple error template
        const fallbackJSON = {
          type: "template",
          templateName: "KineticHero",
          props: {
            headline: "Error Parsing JSON",
            subheadline: "The AI returned invalid format.",
            primaryColor: "#ef4444", backgroundColor: "#000", textColor: "#fff", fontFamily: "Inter"
          }
        };
        return NextResponse.json({ videoCode: JSON.stringify(fallbackJSON), duration });
      }
    }

    return NextResponse.json({ videoCode: cleanCode, duration });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video code." },
      { status: 500 }
    );
  }
}